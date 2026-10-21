"""Read current Data products for the local explorer. Never acquire or rewrite science.

Wire encodings are generated automatically into process-owned temporary directories.
Existing browser encodings are an optional startup optimization, accepted only after
checking their current source bindings. They are never a fallback for changed inputs.
"""
import argparse
import contextlib
import copy
import hashlib
import json
import sys
import signal
import tempfile
from pathlib import Path


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def read(path):
    return json.loads(Path(path).read_text())


def asset_urls(value):
    if isinstance(value, dict):
        if isinstance(value.get('url'), str) and 'sha256' in value:
            yield value['url']
        for item in value.values():
            yield from asset_urls(item)
    elif isinstance(value, list):
        for item in value:
            yield from asset_urls(item)


class Sources:
    def __init__(self, data, public, study, weather=None, pilot=None, components=None):
        self.data, self.public, self.study = Path(data), Path(public), Path(study)
        self.weather = Path(weather) if weather else self.data/'Meteorology'
        self.pilot = Path(pilot) if pilot else None
        self.components = Path(components) if components else None

    def live_pilot(self):
        # A completed pilot delivered into Data/viewshed needs no app configuration.
        candidate = self.data/'viewshed'
        return self.pilot or (candidate if (candidate/'runtime.json').exists() else None)

    def root(self, domain):
        if domain == 'river-influence':
            entry = read(self.data/'Hydrology/catalog.json').get('products', {}).get('influence', {})
            if entry.get('path') != 'influence.parquet':
                raise ValueError('Missing or unsafe Hydrology influence catalog entry')
            return self.data/'Hydrology'/entry['path']
        return {'seascape': self.data/'Seascape', 'governance': self.data/'Governance',
                'human': self.data/'Human', 'meteorology': self.weather,
                'orca': self.data/'MarineMammals/Orca/Sightings',
                'hydrology': self.data/'Hydrology',
                'viewshed': self.live_pilot() or self.public/'viewshed'}[domain]

    def dependencies(self, domain):
        root = self.root(domain)
        paths = [root]
        # Delivery roots only: raw acquisition stores and producer work trees are not watched.
        members = () if domain == 'river-influence' else root.rglob('*') if domain in {'hydrology', 'viewshed'} else root.iterdir()
        paths += sorted(p for p in members if p.is_file() and p.suffix in {'.json', '.parquet', '.txt', '.geojson'} and not (domain == 'hydrology' and p.name == 'influence.parquet'))
        if domain == 'human' and (root/'static.parquet').exists():
            import pyarrow.parquet as pq
            receipt = json.loads(pq.read_schema(root/'static.parquet').metadata[b'human_delivery'])['receipt_path']
            paths.append(Path(receipt))
        if domain == 'orca':
            paths += sorted(p for p in root.parent.rglob('*') if p.is_file() and p.suffix in {'.json', '.parquet'})
            study = read(root/'catalog.json').get('study', {})
            paths += [Path(study[k]) for k in ('mask_path', 'r6_registry_path') if k in study]
        if domain == 'river-influence':
            paths += [self.study, self.data/'Hydrology/catalog.json']
        if domain == 'hydrology':
            paths.append(self.study)
            config = read(self.study)
            paths += [(self.study.parent/m['relative_path']).resolve() for m in config['grid_registry']['memberships'] if m['resolution'] == 6 and m['role'] == 'water_reporting']
        if domain == 'viewshed':
            delivered = self.data/'viewshed'
            if delivered.exists():
                paths += [delivered, *sorted(p for p in delivered.rglob('*') if p.is_file())]
            if self.components:
                paths += sorted(self.components.rglob('*'))
        # Adapter edits also invalidate their encoding; source semantics never depend on an old reader.
        scripts = Path(__file__).parent
        paths += sorted(p for p in scripts.iterdir() if p.is_file() and not p.name.startswith('test_') and p.suffix in {'.py', '.json'})
        return sorted(set(paths), key=str)

    def version(self, domain):
        try:
            facts = []
            for path in self.dependencies(domain):
                stat = path.stat()
                facts.append((str(path), str(path.resolve()), stat.st_ino, stat.st_size, stat.st_mtime_ns, stat.st_ctime_ns))
            return hashlib.sha256(json.dumps(facts).encode()).hexdigest()
        except Exception as error:
            return 'unavailable:' + str(error)

    def versions(self):
        return {d: self.version(d) for d in ('seascape', 'governance', 'human', 'meteorology', 'orca', 'hydrology', 'river-influence', 'viewshed')}


class Reader:
    def __init__(self, sources):
        self.sources = sources
        self.current = {}
        self.previous = {}
        self.temp = tempfile.TemporaryDirectory(prefix='marinecast-live-')
        self.directory = Path(self.temp.name)
        self.serial = 0
        self.weather_store = None

    def close(self):
        self.temp.cleanup()

    def seed_base(self, domain):
        """Validate the existing encoding against the complete current product bindings."""
        from human_input import bindings as human_bindings
        from governance_input import bindings as governance_bindings
        seed = read(self.sources.public/'seascape/catalog.json')
        root = self.sources.root(domain)
        if domain == 'human':
            expected = human_bindings(root)['catalog']['sha256']
        elif domain == 'governance':
            expected = governance_bindings(root)['catalog.json']['sha256']
        else:
            expected = digest(root/'catalog.json')
        if seed['datasets'][domain]['manifestSha256'] != expected:
            raise ValueError('Source catalog changed')
        features = [f for f in seed['features'] if f.get('dataset', 'seascape') == domain]
        if domain == 'governance':
            from conservation_input import CORE_ASSIGNMENT, ASSIGNMENT as CONSERVATION_ASSIGNMENT
            if (any(f.get('column') == CORE_ASSIGNMENT for f in features)
                    and not any(f.get('membershipColumn') == CONSERVATION_ASSIGNMENT for f in features)):
                raise ValueError('Conservation startup encoding needs the status-qualified assignment view')
            from coast_guard_input import ASSIGNMENT, GROUP, coast_guard_features
            if (any(f.get('column', '').startswith(GROUP + '__') for f in features)
                    and not any(f.get('membershipColumn') == ASSIGNMENT for f in features)):
                raise ValueError('Coast Guard startup encoding needs the combined membership view')
            from governance_input import tribal_features, wildlife_refuge_features, regional_features, water_features, administrative_features, management_features, conservation_features, vessel_routing_features, critical_habitat_features
            features = critical_habitat_features(vessel_routing_features(conservation_features(coast_guard_features(management_features(administrative_features(regional_features(water_features(tribal_features(wildlife_refuge_features(features))))))))))
        if domain == 'seascape':
            from biogenic_input import biogenic_features
            features = biogenic_features(features)
        ids = {f['productId'] for f in features}
        products = {key: value for key, value in seed['products'].items() if key in ids}
        files = {}
        for product in products.values():
            for table in product.get('slices', {'static': product}).values():
                path = root/Path(table['sourcePath'])
                files[path] = table['sourceSha256']
        if domain == 'seascape':
            expected_files = {name for record in read(root/'catalog.json').values() for kind in ('static', 'dynamic') for name in record.get(kind, {}).values()}
            if {p.name for p in files} != expected_files:
                raise ValueError('Source product roster changed')
        if not products or any(digest(path) != sha for path, sha in files.items()):
            raise ValueError('Source product changed')
        component = copy.deepcopy(seed)
        component.update(features=features, products=products, datasets={domain: seed['datasets'][domain]})
        if domain != 'seascape':
            component['resolutions'] = {}
        folder = self.sources.public/'seascape'
        checked = set()
        def verify(value):
            if isinstance(value, dict):
                if isinstance(value.get('url'), str) and 'sha256' in value:
                    url = value['url']
                    prefix = '/local-data/seascape/'
                    if not url.startswith(prefix) or '..' in url.split('/'):
                        raise ValueError('Invalid startup asset binding')
                    path = folder/url.removeprefix(prefix)
                    if url not in checked and (not path.is_file() or not path.resolve().is_relative_to(folder.resolve()) or digest(path) != value['sha256']):
                        raise ValueError('Startup asset is missing or changed')
                    checked.add(url)
                for item in value.values():
                    verify(item)
            elif isinstance(value, list):
                for item in value:
                    verify(item)
        verify(component)
        return component, folder

    def build(self, domain, output):
        root = self.sources.root(domain)
        if domain == 'seascape':
            from prepare_flat_map import prepare_flat
            prepare_flat(root, None, output)
        elif domain in {'human', 'governance'}:
            from prepare_map import Exporter
            module = __import__(domain+'_input')
            token = hashlib.sha256((self.sources.version(domain)+str(self.serial)).encode()).hexdigest()
            component = {'products': {}, 'features': [], 'datasets': {}, 'resolutions': {}}
            folder = output/token
            folder.mkdir(parents=True)
            getattr(module, 'append_'+domain)(Exporter(folder, token), component, root)
            (output/'catalog.json').write_text(json.dumps(component, allow_nan=False))
        elif domain == 'meteorology':
            from meteorology_data import prepare
            prepare(root, output)
        elif domain == 'orca':
            from orca_input import prepare
            prepare(root.resolve(), output)
        elif domain == 'river-influence':
            from river_influence_input import prepare
            prepare(root, self.sources.study, self.sources.data/'Hydrology', output)
        elif domain == 'hydrology':
            from hydrology_input import prepare
            prepare(root, self.sources.study, output)
        elif domain == 'viewshed' and self.sources.live_pilot():
            from prepare_viewshed import prepare
            components = self.sources.components
            if components is None and (root/'components/manifest.json').is_file():
                components = root/'components'
            prepare(root, output, components)
        else:
            # Data/viewshed currently declares no completed pair product. Retain the
            # explicitly qualified pilot until a completed producer output is configured.
            return read(root/'catalog.json'), root
        return read(output/'catalog.json'), output

    def get(self, domain):
        version = self.sources.version(domain)
        existing = self.current.get(domain)
        if existing and existing['version'] == version:
            return existing
        if version.startswith('unavailable:'):
            raise ValueError(version)
        self.serial += 1
        output = self.directory/f'{domain}-{self.serial}'
        output.mkdir()
        try:
            try:
                if domain in {'seascape', 'governance', 'human'}:
                    catalog, folder = self.seed_base(domain)
                elif domain == 'meteorology':
                    from meteorology_data import Store
                    store = Store(self.sources.root(domain), self.sources.public/domain)
                    # File size/mtime alone cannot prove that a replaced Parquet is
                    # the validated product (copy tools may preserve both).
                    if any(digest(self.sources.root(domain)/name) != binding['sha256'] for name, binding in store.manifest['bindings'].items()):
                        raise ValueError('Weather source checksum changed')
                    catalog, folder = store.manifest, self.sources.public/domain
                else:
                    raise ValueError('Read current source')
            except (OSError, ValueError, KeyError, TypeError):
                with contextlib.redirect_stdout(sys.stderr):
                    catalog, folder = self.build(domain, output)
            prefix = '/local-data/'+('seascape' if domain in {'seascape', 'governance', 'human'} else domain)+'/'
            assets = {}
            for url in asset_urls(catalog):
                if not url.startswith(prefix) or '..' in url.split('/') or '?' in url or '#' in url:
                    raise ValueError('Invalid local asset path')
                path = folder/url.removeprefix(prefix)
                if not path.is_file() or not path.resolve().is_relative_to(folder.resolve()):
                    raise ValueError('Local asset unavailable: '+url)
                assets[url] = path
            if version != self.sources.version(domain):
                raise ValueError('Source files changed during read; retry when the producer finishes writing')
        except BaseException:
            import shutil
            shutil.rmtree(output)
            raise
        result = {'version': version, 'catalog': catalog, 'assets': assets, 'output': output}
        # At most current and one previous generation per domain support in-flight reads.
        obsolete = self.previous.pop(domain, None)
        if obsolete:
            import shutil
            shutil.rmtree(obsolete['output'])
        if existing:
            self.previous[domain] = existing
        self.current[domain] = result
        if domain == 'meteorology':
            from meteorology_data import Store
            self.weather_store = Store(self.sources.root(domain), folder)
        return result

    def base(self):
        base = copy.deepcopy(self.get('seascape')['catalog'])
        errors = []
        for domain in ('governance', 'human'):
            try:
                component = self.get(domain)['catalog']
                base['products'].update(component['products'])
                base['features'].extend(component['features'])
                base['datasets'].update(component['datasets'])
            except Exception as error:
                errors.append({'name': domain.title(), 'reason': str(error)})
        base['unavailableProducts'] = errors
        base['manifestSha256'] = hashlib.sha256(json.dumps(base, sort_keys=True).encode()).hexdigest()
        return base

    def request(self, request):
        operation = request.get('operation')
        if operation == 'versions':
            return self.sources.versions()
        if operation in {'daily', 'hourly'}:
            self.get('meteorology')
            return self.weather_store.query(request)
        path = request.get('path', '')
        parts = path.split('/')
        if len(parts) < 4 or parts[:2] != ['', 'local-data'] or any(p in {'.', '..'} for p in parts):
            raise ValueError('Unsupported local read')
        domain = parts[2]
        if domain not in {'seascape', 'meteorology', 'orca', 'hydrology', 'river-influence', 'viewshed'}:
            raise ValueError('Unknown data domain')
        if path == f'/local-data/{domain}/catalog.json':
            return {'json': self.base() if domain == 'seascape' else self.get(domain)['catalog']}
        domains = ('seascape', 'governance', 'human') if domain == 'seascape' else (domain,)
        for item in domains:
            try:
                current = self.get(item)
            except Exception:
                # A broken updated domain must not fall back to its old values.
                continue
            for generation in (current, self.previous.get(item, {})):
                if path in generation.get('assets', {}):
                    return {'file': str(generation['assets'][path])}
        raise ValueError('Asset is not part of a current validated product')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', type=Path, required=True)
    parser.add_argument('--public', type=Path, required=True)
    parser.add_argument('--study', type=Path, required=True)
    parser.add_argument('--weather', type=Path)
    parser.add_argument('--pilot', type=Path)
    parser.add_argument('--components', type=Path)
    args = parser.parse_args()
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    reader = Reader(Sources(args.data, args.public, args.study, args.weather, args.pilot, args.components))
    try:
        for line in sys.stdin:
            request = {}
            try:
                request = json.loads(line)
                result = reader.request(request)
                response = {'id': request['id'], 'result': result}
            except Exception as error:
                response = {'id': request.get('id'), 'error': str(error)}
            print(json.dumps(response, allow_nan=False, separators=(',', ':')), flush=True)
    finally:
        reader.close()


if __name__ == '__main__':
    main()
