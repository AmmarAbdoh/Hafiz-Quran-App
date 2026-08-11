import "i18next";
import type { defaultNamespace, resources } from "./resources";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNamespace;
    returnNull: false;
    resources: (typeof resources)["en"];
  }
}
