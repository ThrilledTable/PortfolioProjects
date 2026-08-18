# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

This repository holds a single T-SQL data-exploration script: `Covid Portfolio Project.sql`. It is a portfolio piece exploring COVID-19 case, death, and vaccination data — there is no application code, build system, package manifest, linter, or test suite.

The script targets Microsoft SQL Server (T-SQL), evident from the bracketed `[Portfolio Project]..TableName` three-part naming, `CONVERT(bigint, ...)`, and `#`-prefixed temp tables.

## Data model

The queries assume a `Portfolio Project` database with two tables (not included in this repo — assumed to be pre-loaded separately):

- **CovidDeaths** — columns include `location`, `date`, `continent`, `population`, `total_cases`, `new_cases`, `total_deaths`, `new_deaths`.
- **CovidVaccinations** — columns include `location`, `date`, `new_vaccinations`.

The two tables join on `location` and `date`. Rows where `continent is null` represent aggregate rows (e.g. "World", "Europe") rather than individual countries, so most per-country queries filter with `Where continent is not null`.

## Script structure

`Covid Portfolio Project.sql` is organized as a sequence of independent, comment-labeled query blocks meant to be run individually (not as one batch), progressing in complexity:

1. Basic selects of cases/deaths/population by location and date.
2. Derived metrics via simple arithmetic (e.g. `DeathPercentage = total_deaths/total_cases*100`, `PercentPopulationInfected = total_cases/population*100`).
3. Aggregations with `MAX`/`GROUP BY` for highest infection/death rates by country and by continent.
4. A global daily rollup using `SUM` across all locations.
5. A rolling vaccination count using a windowed `SUM(...) OVER (PARTITION BY location ORDER BY location, date)`.
6. The same rolling-vaccination query re-expressed three ways to demonstrate different SQL techniques: a CTE (`PopvsVac`), a temp table (`#PercentPopulationVaccinated`), and finally a `CREATE VIEW PercentPopulationVaccinated` — the view is the durable artifact intended for downstream visualization tools.

When editing, keep new queries in this same pattern: a `--` comment header describing intent, followed by the query, appended in logical order after the existing sections.

## Working with this repo

There are no build, lint, or test commands — changes are plain SQL edits. If you need to validate a query, it must be run against a live SQL Server instance with the `Portfolio Project` database loaded (not available in this environment).
