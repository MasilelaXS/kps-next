import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Generate PDF from HTML content
 * @param html - HTML string to convert to PDF
 * @param filename - Output filename
 */
export async function generatePDFFromHTML(html: string, filename: string): Promise<void> {
  // Create hidden container
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '210mm'; // A4 width
  container.style.padding = '0';
  container.style.margin = '0';
  container.style.boxSizing = 'border-box';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    // Convert to canvas with proper scaling
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: 794, // A4 width in pixels at 96 DPI (210mm)
      windowHeight: container.scrollHeight,
      scrollY: -window.scrollY,
      scrollX: -window.scrollX,
      backgroundColor: '#ffffff',
    });

    // Calculate PDF dimensions with margins
    const pdfWidth = 210; // A4 width in mm
    const pdfHeight = 297; // A4 height in mm
    const margin = 10; // 10mm margins
    const contentWidth = pdfWidth - (2 * margin);
    const contentHeight = pdfHeight - (2 * margin);
    
    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * contentWidth) / canvas.width;
    
    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgData = canvas.toDataURL('image/png', 1.0);
    
    let heightLeft = imgHeight;
    let position = 0;

    // Add first page with margins
    pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
    heightLeft -= contentHeight;

    // Add additional pages if content is longer than one page
    while (heightLeft > 0) {
      position = -(contentHeight * Math.ceil((imgHeight - heightLeft) / contentHeight));
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position + margin, imgWidth, imgHeight);
      heightLeft -= contentHeight;
    }

    // Save PDF
    pdf.save(filename);
  } finally {
    // Cleanup
    document.body.removeChild(container);
  }
}
