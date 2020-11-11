# setup-postgres

:fire: Action to set up Postgres

Supports:

- Linux and Mac (`ubuntu-20.04`, `ubuntu-18.04`, `ubuntu-16.04`, and `macos-10.15`)
- Many versions (`13`, `12`, `11`, `10`, and `9.6`)

[![Build Status](https://github.com/ankane/setup-postgres/workflows/build/badge.svg?branch=v1)](https://github.com/ankane/setup-postgres/actions)

## Getting Started

Add it to your workflow

```yml
jobs:
  build:
    steps:
    - uses: ankane/setup-postgres@v1
```

Specify a version (defaults to `13` if no version is specified)

```yml
jobs:
  build:
    steps:
    - uses: ankane/setup-postgres@v1
      with:
        postgres-version: 12
```

Test against multiple versions

```yml
jobs:
  build:
    strategy:
      matrix:
        postgres-version: [13, 12, 11, 10, 9.6]
    steps:
    - uses: ankane/setup-postgres@v1
      with:
        postgres-version: ${{ matrix.postgres-version }}
```
