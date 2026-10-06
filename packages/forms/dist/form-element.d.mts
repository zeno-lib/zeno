import { ComponentProps, ReactNode } from "react";
//#region src/form-element.d.ts
type FormProviderProps = {
  children: ReactNode;
  form: {
    handleSubmit: () => unknown;
  };
};
declare function FormProvider({ children, form }: FormProviderProps): import("react/jsx-runtime").JSX.Element;
type FormProps = Omit<ComponentProps<"form">, "onSubmit">;
declare function Form({ children, className, ...props }: FormProps): import("react/jsx-runtime").JSX.Element;
//#endregion
export { Form, FormProvider };