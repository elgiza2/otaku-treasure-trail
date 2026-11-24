import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = (props: ToasterProps) => (
  <Sonner
    className="toaster group"
    toastOptions={{
      unstyled: true,
      classNames: {
        toast: "app-toast flex w-[calc(100vw-2rem)] max-w-sm items-center gap-3 rounded-2xl px-4 py-3 font-bold text-foreground",
        title: "text-sm leading-snug",
        description: "text-xs font-normal text-muted-foreground",
        icon: "app-toast-icon flex size-8 shrink-0 items-center justify-center rounded-full",
        success: "app-toast-success",
        error: "app-toast-error",
        actionButton: "rounded-lg bg-primary px-3 py-1 text-xs text-primary-foreground",
      },
    }}
    {...props}
  />
);

export { Toaster };
