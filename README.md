# setup-postgres

The missing action for Postgres :tada:

- Faster and simpler than containers
- Works on Linux, Mac, and Windows
- Supports different versions

[![Build Status](https://github.com/ankane/setup-postgres/workflows/build/badge.svg?branch=v1)](https://github.com/ankane/setup-postgres/actions)

## Getting Started

Add it as a step to your workflow

```yml
    - uses: ankane/setup-postgres@v1
```

## Versions

Specify a version (defaults to the latest)

```yml
    - uses: ankane/setup-postgres@v1
      with:
        postgres-version: 13
```

Currently supports `13`, `12`, `11`, `10`, and `9.6`. Only the latest version is supported on Windows.

Test against multiple versions

```yml
    strategy:
      matrix:
        postgres-version: [13, 12, 11, 10, 9.6]
    steps:
    - uses: ankane/setup-postgres@v1
      with:
        postgres-version: ${{ matrix.postgres-version }}
```

## Extra Steps

Create a database

```yml
    - run: createdb testdb
```

Run queries

```yml
    - run: psql -d testdb -c 'SHOW server_version'
```

## Config

Set config

```yml
    - uses: ankane/setup-postgres@v1
      with:
        config: |
          shared_preload_libraries = 'pg_stat_statements'
```

## Related Actions

- [setup-mysql](https://github.com/ankane/setup-mysql)
- [setup-mariadb](https://github.com/ankane/setup-mariadb)
- [setup-mongodb](https://github.com/ankane/setup-mongodb)
- [setup-elasticsearch](https://github.com/ankane/setup-elasticsearch)

## Contributing

Everyone is encouraged to help improve this project. Here are a few ways you can help:

- [Report bugs](https://github.com/ankane/setup-postgres/issues)
- Fix bugs and [submit pull requests](https://github.com/ankane/setup-postgres/pulls)
- Write, clarify, or fix documentation
- Suggest or add new features
