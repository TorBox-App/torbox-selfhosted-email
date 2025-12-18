declare module "asciinema-player" {
  export type AsciinemaPlayerOptions = {
    cols?: number;
    rows?: number;
    autoPlay?: boolean;
    preload?: boolean;
    loop?: boolean | number;
    startAt?: number | string;
    speed?: number;
    idleTimeLimit?: number;
    theme?: string;
    poster?: string;
    fit?: "width" | "height" | "both" | "none" | false;
    terminalFontSize?: string;
    terminalFontFamily?: string;
    terminalLineHeight?: number;
  };

  export type AsciinemaPlayerInstance = {
    play(): void;
    pause(): void;
    seek(location: number | string): void;
    getCurrentTime(): number;
    getDuration(): number;
    dispose(): void;
  };

  export function create(
    src: string,
    container: HTMLElement,
    options?: AsciinemaPlayerOptions
  ): AsciinemaPlayerInstance;
}
