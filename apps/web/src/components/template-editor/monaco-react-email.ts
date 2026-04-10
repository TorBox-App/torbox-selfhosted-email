import type { Monaco } from "@monaco-editor/react";

const configuredInstances = new WeakSet<object>();

export function configureMonacoForReactEmail(monaco: Monaco) {
  if (configuredInstances.has(monaco)) {
    return;
  }
  configuredInstances.add(monaco);

  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    jsx: monaco.languages.typescript.JsxEmit.React,
    reactNamespace: "React",
    allowNonTsExtensions: true,
    allowJs: true,
    esModuleInterop: true,
    noEmit: true,
    typeRoots: ["node_modules/@types"],
  });

  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    diagnosticCodesToIgnore: [
      2307, // Cannot find module (addExtraLib provides types, but Monaco can't resolve the path)
      7016, // Could not find declaration file
    ],
  });

  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    REACT_TYPES,
    "ts:filename/react.d.ts"
  );

  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    REACT_EMAIL_TYPES,
    "ts:filename/react-email-components.d.ts"
  );

  monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
}

const REACT_TYPES = `
declare namespace React {
  type ReactNode = string | number | boolean | null | undefined | ReactElement | ReactNode[];
  interface ReactElement<P = any> { type: any; props: P; key: string | null; }
  type FC<P = {}> = (props: P) => ReactElement | null;
  interface CSSProperties { [key: string]: string | number | undefined; }
  interface HTMLAttributes<T> { className?: string; style?: CSSProperties; id?: string; children?: ReactNode; [key: string]: any; }
  interface AnchorHTMLAttributes<T> extends HTMLAttributes<T> { href?: string; target?: string; rel?: string; }
  interface ImgHTMLAttributes<T> extends HTMLAttributes<T> { src?: string; alt?: string; width?: number | string; height?: number | string; }
  interface TableHTMLAttributes<T> extends HTMLAttributes<T> { cellPadding?: number | string; cellSpacing?: number | string; }
  interface TdHTMLAttributes<T> extends HTMLAttributes<T> { colSpan?: number; rowSpan?: number; }
  interface HtmlHTMLAttributes<T> extends HTMLAttributes<T> { lang?: string; dir?: string; }
  function createElement(type: any, props?: any, ...children: ReactNode[]): ReactElement;
  namespace JSX {
    interface Element extends ReactElement {}
    interface IntrinsicElements { [key: string]: any; }
    interface ElementChildrenAttribute { children: {}; }
  }
}
declare module "react" {
  export = React;
  export as namespace React;
}
`;

const REACT_EMAIL_TYPES = `
declare module "@react-email/components" {
  export const Html: React.FC<React.HtmlHTMLAttributes<any>>;
  export const Head: React.FC<React.HTMLAttributes<any>>;
  export const Body: React.FC<React.HtmlHTMLAttributes<any>>;
  export const Container: React.FC<React.TableHTMLAttributes<any>>;
  export const Section: React.FC<React.TableHTMLAttributes<any>>;
  export const Row: React.FC<React.TableHTMLAttributes<any> & { children: React.ReactNode }>;
  export const Column: React.FC<React.TdHTMLAttributes<any>>;
  export const Text: React.FC<React.HTMLAttributes<any>>;
  export const Link: React.FC<React.AnchorHTMLAttributes<any>>;
  export const Button: React.FC<React.AnchorHTMLAttributes<any>>;
  export const Img: React.FC<React.ImgHTMLAttributes<any>>;
  export const Hr: React.FC<React.HTMLAttributes<any>>;
  export const Preview: React.FC<React.HTMLAttributes<any> & { children: string | string[] }>;
  export const Heading: React.FC<React.HTMLAttributes<any> & {
    as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    m?: number | string; mx?: number | string; my?: number | string;
    mt?: number | string; mr?: number | string; mb?: number | string; ml?: number | string;
  }>;
  export const Tailwind: React.FC<{ children: React.ReactNode; config?: Record<string, any> }>;
  export const Font: React.FC<{
    fontFamily: string;
    fallbackFontFamily: string | string[];
    webFont?: { url: string; format: "woff" | "woff2" | "truetype" | "opentype" };
    fontStyle?: string;
    fontWeight?: number | string;
  }>;
  export const CodeBlock: React.FC<{
    code: string; language?: string; theme?: Record<string, React.CSSProperties>;
    lineNumbers?: boolean; style?: React.CSSProperties;
  }>;
  export const CodeInline: React.FC<React.HTMLAttributes<any>>;
  export const Markdown: React.FC<{
    children: string;
    markdownContainerStyles?: React.CSSProperties;
    markdownCustomStyles?: Record<string, React.CSSProperties>;
  }>;
}
`;
