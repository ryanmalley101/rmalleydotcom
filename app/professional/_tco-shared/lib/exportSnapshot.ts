export async function exportSnapshot(element: HTMLElement, filename: string) {
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(element, {
    backgroundColor: "#0f1117",
    scale: 2,
  });
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = filename;
  link.click();
}

export function downloadText(text: string, filename: string, type: string) {
  const blob = new Blob([text], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Opens a plain, light-themed report in a new tab and starts printing, so
// it can be saved as a PDF from the browser's print dialog.
export function openPrintable(html: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}
