# setup-postgres

Action to set up Postgres

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
