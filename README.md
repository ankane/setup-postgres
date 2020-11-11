## setup-postgres

Action to set up Postgres

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
        postgres-version: [9.6, 10, 11, 12, 13]
    steps:
    - uses: ankane/setup-postgres@v1
      with:
        postgres-version: ${{ matrix.postgres-version }}
```
