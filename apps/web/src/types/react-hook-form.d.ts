/**
 * Minimal type declarations for react-hook-form
 * To fix build errors when package is not installed
 */

declare module "react-hook-form" {
  export type FieldValues = Record<string, any>;

  export type Path<T extends FieldValues> = string;

  export interface UseFormReturn<TFieldValues extends FieldValues = FieldValues> {
    register: (name: Path<TFieldValues>) => any;
    handleSubmit: (onValid: (data: TFieldValues) => void) => (e?: React.BaseSyntheticEvent) => Promise<void>;
    formState: {
      errors: Partial<Record<Path<TFieldValues>, { message?: string }>>;
      isSubmitting: boolean;
      isDirty: boolean;
      isValid: boolean;
    };
    watch: (name?: Path<TFieldValues>) => any;
    setValue: (
      name: Path<TFieldValues>,
      value: any,
      options?: {
        shouldDirty?: boolean;
        shouldValidate?: boolean;
        shouldTouch?: boolean;
      }
    ) => void;
    getValues: (name?: Path<TFieldValues>) => any;
    reset: (values?: Partial<TFieldValues>) => void;
  }
}
