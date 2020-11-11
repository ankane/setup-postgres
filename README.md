## setup-postgres

Action to set up Postgres

```yml
jobs:
  build:
    uses: ankane/setup-postgres@v1
```

Specify a version (defaults to `13` if no version is specified)

```yml
jobs:
  build:
    uses: ankane/setup-postgres@v1
    with:
      postgres-version: 12
```
