import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export type ParamType = "string" | "number" | "boolean";

type ParamConfig<T> = {
  type: ParamType;
  defaultValue: T;
};

type ParamMap = Record<string, ParamConfig<any>>;

type ParamValues<TConfig extends ParamMap> = {
  [K in keyof TConfig]: TConfig[K]["defaultValue"];
};

type SetParamsAction<TConfig extends ParamMap> =
  | Partial<ParamValues<TConfig>>
  | ((prev: ParamValues<TConfig>) => Partial<ParamValues<TConfig>>);

function serializeValue(value: unknown) {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "1" : "0";
  return String(value);
}

function parseValue<T>(raw: string | null, config: ParamConfig<T>): T {
  if (raw == null || raw === "") {
    return config.defaultValue;
  }

  switch (config.type) {
    case "number": {
      const parsed = Number(raw);
      return (Number.isFinite(parsed) ? (parsed as unknown as T) : config.defaultValue);
    }
    case "boolean": {
      return ((raw === "1" || raw.toLowerCase() === "true") as unknown as T) ?? config.defaultValue;
    }
    default:
      return raw as unknown as T;
  }
}

function buildParamKey(namespace: string, key: string) {
  return `${namespace}_${key}`;
}

export function useListParams<TConfig extends ParamMap>(
  namespace: string,
  config: TConfig,
): {
  params: ParamValues<TConfig>;
  setParams: (updates: SetParamsAction<TConfig>) => void;
  resetParams: () => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo(() => {
    const current: Record<string, unknown> = {};
    for (const key of Object.keys(config)) {
      const paramKey = buildParamKey(namespace, key);
      current[key] = parseValue(searchParams.get(paramKey), config[key]!);
    }
    return current as ParamValues<TConfig>;
  }, [config, namespace, searchParams]);

  const setParams = useCallback(
    (updates: SetParamsAction<TConfig>) => {
      const next = new URLSearchParams(searchParams);
      const resolvedUpdates = typeof updates === "function" ? updates(params) : updates;
      for (const [key, value] of Object.entries(resolvedUpdates)) {
        const configEntry = config[key];
        if (!configEntry) continue;
        const paramKey = buildParamKey(namespace, key);
        if (value === undefined || value === configEntry.defaultValue || value === null || value === "") {
          next.delete(paramKey);
        } else {
          next.set(paramKey, serializeValue(value));
        }
      }
      setSearchParams(next, { replace: true });
    },
    [config, namespace, params, searchParams, setSearchParams],
  );

  const resetParams = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    for (const key of Object.keys(config)) {
      next.delete(buildParamKey(namespace, key));
    }
    setSearchParams(next, { replace: true });
  }, [config, namespace, searchParams, setSearchParams]);

  return { params, setParams, resetParams };
}
