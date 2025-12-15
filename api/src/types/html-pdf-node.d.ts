declare module 'html-pdf-node' {
  export interface Options {
    format?: string;
    path?: string;
    printBackground?: boolean;
    margin?: {
      top?: string;
      right?: string;
      bottom?: string;
      left?: string;
    };
    displayHeaderFooter?: boolean;
    headerTemplate?: string;
    footerTemplate?: string;
    preferCSSPageSize?: boolean;
    landscape?: boolean;
    pageRanges?: string;
    width?: string;
    height?: string;
    scale?: number;
  }

  export interface File {
    content: string;
    url?: string;
  }

  function generatePdf(file: File, options?: Options): Promise<Buffer>;
  function generatePdfs(files: File[], options?: Options): Promise<Buffer[]>;

  const htmlPdfNode: {
    generatePdf: typeof generatePdf;
    generatePdfs: typeof generatePdfs;
  };

  export default htmlPdfNode;
}
