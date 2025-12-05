import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormProps, type UseFormReturn } from "react-hook-form";
import type { z } from "zod";

interface UseZodFormProps<TSchema extends z.ZodTypeAny>
  extends Omit<UseFormProps<z.infer<TSchema>>, "resolver"> {
  schema: TSchema;
}

export function useZodForm<TSchema extends z.ZodTypeAny>({
  schema,
  ...formConfig
}: UseZodFormProps<TSchema>): UseFormReturn<z.infer<TSchema>> {
  return useForm<z.infer<TSchema>>({
    ...formConfig,
    resolver: zodResolver(schema),
  });
}
