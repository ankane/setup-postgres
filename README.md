# setup-postgres

The missing action for Postgres - no need for containers :tada:

Supports:

- Linux and Mac (`ubuntu-20.04`, `ubuntu-18.04`, `ubuntu-16.04`, and `macos-10.15`)
- Different versions (`13`, `12`, `11`, `10`, and `9.6`)

[![Build Status](https://github.com/ankane/setup-postgres/workflows/build/badge.svg?branch=v1)](https://github.com/ankane/setup-postgres/actions)

## Getting Started

Add it as a step to your workflow

```yml
    - uses: ankane/setup-postgres@v1
```

Specify a version (defaults to the latest if no version is specified)

```yml
    - uses: ankane/setup-postgres@v1
      with:
        postgres-version: 13
```

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
