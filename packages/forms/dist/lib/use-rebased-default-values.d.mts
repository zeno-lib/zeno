import { AnyFormApi } from "@tanstack/react-form";
//#region src/lib/use-rebased-default-values.d.ts
declare function useRebasedDefaultValues<T>(callerDefaults: T): {
  defaultValues: T;
  onMount: (props: {
    formApi: AnyFormApi;
  }) => void;
};
//#endregion
export { useRebasedDefaultValues };