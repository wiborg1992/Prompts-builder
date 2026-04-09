declare module "mammoth" {
  interface ConversionResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }

  interface ExtractRawTextOptions {
    buffer?: Buffer;
    path?: string;
    arrayBuffer?: ArrayBuffer;
  }

  function extractRawText(input: ExtractRawTextOptions): Promise<ConversionResult>;
  function convertToHtml(input: ExtractRawTextOptions, options?: object): Promise<ConversionResult>;
  function convertToMarkdown(input: ExtractRawTextOptions, options?: object): Promise<ConversionResult>;
}
