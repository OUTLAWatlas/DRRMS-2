import { useCallback, useMemo } from "react";
import { useListParams, type ParamType } from "@/hooks/use-list-params";

export type SortDirection = "asc" | "desc";

export type TableFilterConfig<TValue extends string | number | boolean> = {
  type: ParamType;
  defaultValue: TValue;
};

type AnyFilterConfig = Record<string, TableFilterConfig<any>>;

type NormalizedFilters<TFilters extends AnyFilterConfig | undefined> = TFilters extends AnyFilterConfig
  ? TFilters
  : Record<never, TableFilterConfig<any>>;

type FilterValues<TFilters extends AnyFilterConfig | undefined> = {
  [K in keyof NormalizedFilters<TFilters>]: NormalizedFilters<TFilters>[K]["defaultValue"];
};

type UseTableStateOptions<
  TSort extends string,
  TFilters extends AnyFilterConfig | undefined = undefined,
> = {
  namespace: string;
  defaults: {
    sortBy: TSort;
    sortDirection?: SortDirection;
    page?: number;
    limit?: number;
  };
  filters?: TFilters;
};

type UseTableStateResult<
  TSort extends string,
  TFilters extends AnyFilterConfig | undefined,
> = {
  page: number;
  limit: number;
  sortBy: TSort;
  sortDirection: SortDirection;
  filters: FilterValues<TFilters>;
  query: {
    page: number;
    limit: number;
    sortBy: TSort;
    sortDirection: SortDirection;
  } & FilterValues<TFilters>;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setSort: (sortBy: TSort, sortDirection?: SortDirection) => void;
  setFilters: (updates: Partial<FilterValues<TFilters>>) => void;
  resetFilters: () => void;
  resetAll: () => void;
};

const clampPositiveInt = (value: number, fallback: number) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.trunc(value));
};

export function useTableState<
  TSort extends string,
  TFilters extends AnyFilterConfig | undefined = undefined,
>(options: UseTableStateOptions<TSort, TFilters>): UseTableStateResult<TSort, TFilters> {
  const { namespace, defaults, filters: providedFilters } = options;
  const filterConfig = (providedFilters ?? ({} as NormalizedFilters<TFilters>)) as NormalizedFilters<TFilters>;
  const defaultPage = clampPositiveInt(defaults.page ?? 1, 1);
  const defaultLimit = clampPositiveInt(defaults.limit ?? 25, 25);
  const defaultSortDirection: SortDirection = defaults.sortDirection ?? "desc";

  const paramConfig: Record<string, { type: ParamType; defaultValue: string | number | boolean }> = {
    page: { type: "number", defaultValue: defaultPage },
    limit: { type: "number", defaultValue: defaultLimit },
    sortBy: { type: "string", defaultValue: defaults.sortBy },
    sortDirection: { type: "string", defaultValue: defaultSortDirection },
  };

  Object.entries(filterConfig).forEach(([key, config]) => {
    paramConfig[key] = config;
  });

  const { params, setParams, resetParams } = useListParams(namespace, paramConfig);

  const filterKeys = useMemo(
    () => Object.keys(filterConfig) as (keyof NormalizedFilters<TFilters> & string)[],
    [filterConfig],
  );

  const filterDefaults = useMemo(() => {
    const next: Record<string, unknown> = {};
    filterKeys.forEach((key) => {
      next[key] = filterConfig[key]?.defaultValue;
    });
    return next as FilterValues<TFilters>;
  }, [filterConfig, filterKeys]);

  const page = params.page as number;
  const limit = params.limit as number;
  const sortBy = params.sortBy as TSort;
  const sortDirection = (params.sortDirection as SortDirection) ?? defaultSortDirection;

  const filters = useMemo(() => {
    const next: Record<string, unknown> = {};
    filterKeys.forEach((key) => {
      next[key] = params[key];
    });
    return next as FilterValues<TFilters>;
  }, [filterKeys, params]);

  const query = useMemo(
    () => ({
      page,
      limit,
      sortBy,
      sortDirection,
      ...filters,
    }),
    [filters, limit, page, sortBy, sortDirection],
  );

  const setPage = useCallback(
    (nextPage: number) => {
      setParams({ page: clampPositiveInt(nextPage, defaultPage) });
    },
    [defaultPage, setParams],
  );

  const setLimit = useCallback(
    (nextLimit: number) => {
      setParams({ limit: clampPositiveInt(nextLimit, defaultLimit), page: 1 });
    },
    [defaultLimit, setParams],
  );

  const setSort = useCallback(
    (nextSortBy: TSort, nextDirection?: SortDirection) => {
      setParams({ sortBy: nextSortBy, sortDirection: nextDirection ?? sortDirection, page: 1 });
    },
    [setParams, sortDirection],
  );

  const setFilters = useCallback(
    (updates: Partial<FilterValues<TFilters>>) => {
      if (!updates) return;
      const entries = Object.entries(updates);
      if (!entries.length) return;
      const payload: Record<string, unknown> = {};
      entries.forEach(([key, value]) => {
        const typedKey = key as keyof FilterValues<TFilters> & string;
        payload[typedKey] = value ?? filterDefaults[typedKey];
      });
      setParams({ ...payload, page: 1 });
    },
    [filterDefaults, setParams],
  );

  const resetFilters = useCallback(() => {
    if (!filterKeys.length) {
      setParams({ page: 1 });
      return;
    }
    const payload: Record<string, unknown> = {};
    filterKeys.forEach((key) => {
      payload[key] = filterDefaults[key];
    });
    setParams({ ...payload, page: 1 });
  }, [filterDefaults, filterKeys, setParams]);

  const resetAll = useCallback(() => {
    resetParams();
  }, [resetParams]);

  return {
    page,
    limit,
    sortBy,
    sortDirection,
    filters,
    query: query as UseTableStateResult<TSort, TFilters>["query"],
    setPage,
    setLimit,
    setSort,
    setFilters,
    resetFilters,
    resetAll,
  };
}
