import path from 'path';
import fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { executeQuery, executeQuerySingle } from '../config/database';
import { logger } from '../config/logger';

const execFileAsync = promisify(execFile);

interface ReportData {
  report: any;
  baitStations: any[];
  fumigationTreatments: any[];
  fumigationAreas: any[];
  fumigationPests: any[];
  insectMonitors: any[];
  aerosolUnits: any[];
  analytics: any;
}

export class PDFService {
  private tempDir: string;
  private logoPath: string;
  private phpBinary: string;
  private pdfScriptPath: string;
  private cachedLogoDataUrl: string | null = null;

  constructor() {
    this.tempDir = path.join(__dirname, '../../temp/reports');
    this.logoPath = path.join(__dirname, '../../../public/logo.png');
    this.phpBinary = process.env.PDF_PHP_PATH || process.env.PHP_PATH || 'php';
    this.pdfScriptPath = process.env.PDF_SERVICE_SCRIPT || path.join(__dirname, '../../pdf-service/generate-pdf.php');
    this.ensureTempDirectory();
  }

  private async ensureTempDirectory() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      logger.info('Temp directory ensured', { tempDir: this.tempDir });
    } catch (error) {
      logger.error('Failed to create temp directory', { tempDir: this.tempDir, error });
    }
  }

  private async cleanupOldFiles() {
    try {
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();
      const maxAge = 60 * 60 * 1000;

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);
        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup old files', { error });
    }
  }

  async generateReportPDF(reportId: number): Promise<string> {
    await this.ensureTempDirectory();
    await this.cleanupOldFiles();

    try {
      logger.info('Starting PDF generation (Dompdf)', { reportId });
      const data = await this.getCompleteReportData(reportId);

      let reportType = data.report.report_type;
      if (!reportType) {
        const hasBaitData = data.baitStations.length > 0;
        const hasFumigationData = data.fumigationTreatments.length > 0 || data.fumigationAreas.length > 0;

        if (hasBaitData && hasFumigationData) {
          reportType = 'both';
        } else if (hasFumigationData) {
          reportType = 'fumigation';
        } else {
          reportType = 'bait_inspection';
        }
      }

      const filename = `Report_${reportId}_${Date.now()}.pdf`;
      const pdfPath = path.join(this.tempDir, filename);
      const htmlPath = path.join(this.tempDir, `Report_${reportId}_${Date.now()}.html`);

      try {
        const html = await this.buildReportHtml(data, reportType);
        await fs.writeFile(htmlPath, html, 'utf8');

        await this.generatePdfFromHtml(htmlPath, pdfPath);

        logger.info('PDF generated successfully', { reportId, filename });
        return pdfPath;
      } finally {
        // Always clean up the temp HTML file regardless of success or failure
        fs.unlink(htmlPath).catch(() => {});
      }
    } catch (error) {
      logger.error('PDF generation error', {
        reportId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateReportHTML(reportId: number): Promise<string> {
    const data = await this.getCompleteReportData(reportId);
    let reportType = data.report.report_type || 'bait_inspection';
    if (reportType === 'both') {
      reportType = 'both';
    }
    return this.buildReportHtml(data, reportType);
  }

  private async generatePdfFromHtml(htmlPath: string, pdfPath: string) {
    await fs.access(this.pdfScriptPath);

    const TIMEOUT_MS = 60000; // 60 seconds

    try {
      const { stdout, stderr } = await execFileAsync(this.phpBinary, [this.pdfScriptPath, htmlPath, pdfPath], {
        timeout: TIMEOUT_MS
      });

      if (stdout) {
        logger.info('Dompdf output', { stdout: stdout.toString() });
      }
      if (stderr) {
        logger.warn('Dompdf warnings', { stderr: stderr.toString() });
      }
    } catch (error: any) {
      // Clean up incomplete PDF file if it was partially written
      fs.unlink(pdfPath).catch(() => {});

      const isTimeout = error?.killed === true || error?.signal === 'SIGTERM' || (error?.message || '').includes('timed out');
      if (isTimeout) {
        logger.error('Dompdf timed out', { timeout: TIMEOUT_MS, htmlPath });
        throw new Error(`PDF generation timed out after ${TIMEOUT_MS / 1000}s. The report may be too large.`);
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Dompdf execution failed', { error: message });
      throw new Error(`Dompdf failed: ${message}`);
    }
  }

  private async buildReportHtml(data: ReportData, reportType: string): Promise<string> {
    const logoDataUrl = await this.getLogoDataUrl();
    const reportTypeLabel = this.formatReportType(reportType);

    const headerHtml = this.renderHeader(logoDataUrl, reportTypeLabel);
    const reportInfoHtml = this.renderReportInfo(data.report, reportTypeLabel);
    const clientPcoHtml = this.renderClientPcoDetails(data.report);

    const baitHtml = this.renderBaitInspection(data);
    const fumigationHtml = this.renderFumigation(data);

    let bodyHtml = '';
    if (reportType === 'fumigation') {
      bodyHtml = `${headerHtml}${reportInfoHtml}${clientPcoHtml}${fumigationHtml}`;
    } else if (reportType === 'both') {
      bodyHtml = `${headerHtml}${reportInfoHtml}${clientPcoHtml}${baitHtml}`
        + '<div class="page-break"></div>'
        + `${headerHtml}${reportInfoHtml}${clientPcoHtml}${fumigationHtml}`;
    } else {
      bodyHtml = `${headerHtml}${reportInfoHtml}${clientPcoHtml}${baitHtml}`;
    }

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Service Report</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 8pt; color: #111; margin: 0; padding: 18px; }
  .header-table { width: 100%; border-bottom: 2px solid #1f5582; padding-bottom: 6px; margin-bottom: 8px; }
  .header-left { width: 70%; vertical-align: top; }
  .header-right { width: 30%; text-align: right; vertical-align: top; font-size: 7pt; color: #666; line-height: 1.2; }
  .brand-row { display: block; }
  .brand-row .logo { display: block; margin-bottom: 4px; }
  .title { display: block; font-size: 12pt; font-weight: bold; color: #1f5582; letter-spacing: 0.2pt; text-align: left; }
  .section-title { font-size: 8.5pt; font-weight: bold; color: #1f5582; margin: 10px 0 4px; padding-bottom: 2px; border-bottom: 1px solid #c7d6e6; }
  .section-title-red { background: #7b1e2b; color: #fff; padding: 4px 6px; font-weight: bold; font-size: 8pt; }
  .info-table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  .info-cell { background: #f5f5f5; padding: 6px; vertical-align: top; border: 1px solid #e2e2e2; }
  .info-label { font-weight: bold; }
  .status-inline { display: inline-flex; align-items: center; gap: 4px; }
  .status-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
  .status-text { font-size: 7pt; font-weight: bold; }
  .status-approved { background: #28a745; }
  .status-pending { background: #ffc107; }
  .status-draft { background: #6c757d; }
  .status-declined { background: #dc3545; }
  .two-col { width: 100%; border-collapse: collapse; margin-top: 8px; }
  .two-col td { width: 50%; vertical-align: top; padding-right: 8px; }
  .summary-table { width: 100%; border-collapse: collapse; margin: 6px 0 10px; }
  .summary-table td { border: 1px solid #d8d8d8; padding: 6px; text-align: center; font-size: 8pt; background: #f2f6fb; }
  .summary-number { font-size: 12pt; font-weight: bold; color: #1f5582; }
  .data-table { width: 100%; border-collapse: collapse; margin: 4px 0 10px; border: 1px solid #d9d9d9; }
  .data-table th { background: #1f5582; color: #fff; font-size: 7pt; padding: 4px; text-align: left; }
  .data-table td { border-bottom: 1px solid #e3e3e3; font-size: 7pt; padding: 3px 4px; }
  .data-table.fumigation-table th { background: #7b1e2b; }
  .fumigation-label { color: #7b1e2b; font-weight: bold; }
  .fumigation-note { color: #7b1e2b; font-style: italic; margin: 4px 0; }
  .data-table tr:nth-child(even) td { background: #f8f8f8; }
  .badge-row { background: #f5f5f5; }
  .rodent-table { width: 100%; border-collapse: collapse; margin: 4px 0 10px; }
  .rodent-table th { background: #1f5582; color: #fff; font-size: 7pt; padding: 4px; text-align: center; }
  .rodent-table td { border: 1px solid #e1e1e1; font-size: 7pt; padding: 4px; text-align: center; }
  .r-low { background: #4caf50; color: #fff; }
  .r-medium { background: #ffeb3b; color: #111; }
  .r-high { background: #ff9800; color: #fff; }
  .r-severe { background: #f44336; color: #fff; }
  .remarks-box { border: 1px solid #e5e5e5; background: #f9f9f9; padding: 6px; min-height: 28px; }
  .rec-box { border: 1px solid #f5d89c; background: #fff3cd; padding: 6px; min-height: 28px; }
  .signature-box { border: 1px solid #ddd; height: 50px; width: 220px; }
  .page-break { page-break-before: always; }
  .footer { border-top: 1px solid #999; margin-top: 14px; padding-top: 6px; text-align: center; font-size: 6pt; color: #666; }
  .logo { height: 36px; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
  }

  private renderHeader(logoDataUrl: string | null, reportTypeLabel: string) {
    const logoHtml = logoDataUrl ? `<img class="logo" src="${logoDataUrl}" />` : '';
    return `
<table class="header-table">
  <tr>
    <td class="header-left">
      <div class="brand-row">
        ${logoHtml}
        <div class="title">SERVICE REPORT</div>
      </div>
    </td>
    <td class="header-right">
      <div><strong>KPS Pest Control</strong></div>
      <div>3B Hamman Street</div>
      <div>Posbus 247</div>
      <div>Groblersdal 0470</div>
      <div>Cell: 082 835 4538</div>
      <div>Adm/Fin: 084 584 0157</div>
      <div>kontakkps@gmail.com</div>
    </td>
  </tr>
</table>
<div class="section-title">${this.escapeHtml(reportTypeLabel)}</div>
`;
  }

  private renderReportInfo(report: any, reportTypeLabel: string) {
    const status = (report.status || 'draft').toLowerCase();
    const statusClass = status === 'approved'
      ? 'status-approved'
      : status === 'pending'
        ? 'status-pending'
        : status === 'declined'
          ? 'status-declined'
          : 'status-draft';

    const signatureHtml = this.renderSignatureImage(report.pco_signature_data, 160, 40);

    return `
<table class="info-table">
  <tr>
    <td class="info-cell" style="width:75%;">
      <div><span class="info-label">Report ID:</span> #${report.id}</div>
      <div><span class="info-label">Report Type:</span> ${this.escapeHtml(reportTypeLabel)}</div>
      <div><span class="info-label">Report Status:</span> <span class="status-inline"><span class="status-dot ${statusClass}"></span><span class="status-text">${this.escapeHtml(status.toUpperCase())}</span></span></div>
      <div><span class="info-label">Service Date:</span> ${this.formatDateWithWeek(report.service_date)}</div>
      <div><span class="info-label">Next Service Date:</span> ${this.formatDate(report.next_service_date) || 'Not scheduled'}</div>
      <div><span class="info-label">Generated:</span> ${this.formatDateTime(new Date())}</div>
    </td>
    <td class="info-cell" style="width:25%; text-align:center;">
      <div class="info-label">PCO Signature</div>
      <div style="margin-top:4px;">${signatureHtml || '<div class="signature-box"></div>'}</div>
      <div style="margin-top:4px;">${this.escapeHtml(report.pco_name || 'N/A')}</div>
      <div style="font-size:7pt; color:#666;">${this.formatDate(report.service_date)}</div>
    </td>
  </tr>
</table>
`;
  }

  private renderClientPcoDetails(report: any) {
    return `
<table class="two-col">
  <tr>
    <td>
      <div class="section-title">Client Details</div>
      <div><strong>${this.escapeHtml(report.client_name || 'N/A')}</strong></div>
      <div>${this.escapeHtml(report.client_address || 'No address')}</div>
    </td>
    <td>
      <div class="section-title">PCO Details</div>
      <div><strong>${this.escapeHtml(report.pco_name || 'N/A')}</strong></div>
      <div>PCO Number: ${this.escapeHtml(report.pco_number || 'N/A')}</div>
    </td>
  </tr>
</table>
`;
  }

  private renderBaitInspection(data: ReportData) {
    const statusSummary = this.calculateStatusSummary(data.baitStations);
    const analytics = data.analytics;

    return `
<div class="section-title">BAIT INSPECTION</div>
<table class="summary-table">
  <tr>
    <td><div>Total Stations</div><div class="summary-number">${analytics.totalBaitStations || 0}</div></td>
    <td><div>Inside Stations</div><div class="summary-number">${analytics.insideBaitStations || 0}</div></td>
    <td><div>Outside Stations</div><div class="summary-number">${analytics.outsideBaitStations || 0}</div></td>
    <td><div>Activity Detected</div><div class="summary-number">${analytics.activeBaitStations || 0}</div></td>
  </tr>
</table>

<div class="section-title">Bait Status Summary</div>
<table class="data-table">
  <tr>
    <th style="width:60%">Bait Status</th>
    <th style="width:20%">Count</th>
    <th style="width:20%">Percentage</th>
  </tr>
  ${this.renderStatusRow('Eaten', statusSummary.eaten)}
  ${this.renderStatusRow('Clean', statusSummary.clean)}
  ${this.renderStatusRow('Wet', statusSummary.wet)}
  ${this.renderStatusRow('Old', statusSummary.old)}
  ${statusSummary.none.total > 0 ? this.renderStatusRow('None (N/A — Replaced/Missing)', statusSummary.none) : ''}
  <tr>
    <td><strong>Total Accessible Stations</strong></td>
    <td><strong>${this.formatNumber0(statusSummary.totalAccessible)}</strong></td>
    <td><strong>100%</strong></td>
  </tr>
</table>

<div class="section-title">Rodent Progress Analysis</div>
<table class="rodent-table">
  <tr>
    <th>Location</th>
    <th>Low (0-5%)</th>
    <th>Medium (6-10%)</th>
    <th>High (11-30%)</th>
    <th>Severe (31%+)</th>
  </tr>
  ${this.renderRodentRow('Inside Areas', statusSummary.insideInfectionRate)}
  ${this.renderRodentRow('Outside Areas', statusSummary.outsideInfectionRate)}
  ${this.renderRodentRow('Overall Total', statusSummary.infectionRate)}
</table>

${this.renderBaitStationDetails(data.baitStations)}
${this.renderChemicalUsage(data.baitStations)}
${this.renderRemarks(data.report)}
${this.renderClientSignature(data.report)}
${this.renderFooter()}
`;
  }

  private renderFumigation(data: ReportData) {
    return `
${this.renderFumigationTreatment(data.fumigationAreas, data.fumigationPests, data.fumigationTreatments)}
${this.renderInsectMonitoring(data.insectMonitors)}
${this.renderAerosolUnits(data.aerosolUnits)}
${this.renderRemarks(data.report)}
${this.renderClientSignature(data.report)}
${this.renderFooter()}
`;
  }

  private renderStatusRow(label: string, statusData: any) {
    return `
<tr>
  <td>${this.escapeHtml(label)}</td>
  <td>${this.formatNumber0(statusData.total || 0)}</td>
  <td>${(statusData.totalPercent || 0).toFixed(1)}%</td>
</tr>`;
  }

  private renderRodentRow(label: string, rate: number) {
    const percentage = Number.isFinite(rate) ? rate : 0;
    const low = percentage <= 5 ? percentage : null;
    const medium = percentage > 5 && percentage <= 10 ? percentage : null;
    const high = percentage > 10 && percentage <= 30 ? percentage : null;
    const severe = percentage > 30 ? percentage : null;

    return `
<tr>
  <td>${this.escapeHtml(label)}</td>
  <td class="${low !== null ? 'r-low' : ''}">${low !== null ? `${percentage.toFixed(1)}%` : '-'}</td>
  <td class="${medium !== null ? 'r-medium' : ''}">${medium !== null ? `${percentage.toFixed(1)}%` : '-'}</td>
  <td class="${high !== null ? 'r-high' : ''}">${high !== null ? `${percentage.toFixed(1)}%` : '-'}</td>
  <td class="${severe !== null ? 'r-severe' : ''}">${severe !== null ? `${percentage.toFixed(1)}%` : '-'}</td>
</tr>`;
  }

  private renderBaitStationDetails(stations: any[]) {
    if (!stations.length) return '';

    const inside = stations.filter(s => (s.location || s.location_type || '').toLowerCase() === 'inside');
    const outside = stations.filter(s => (s.location || s.location_type || '').toLowerCase() === 'outside');

    return `
<div class="section-title">BAIT STATION DETAILS - INSIDE (${inside.length})</div>
${this.renderStationTable(inside)}
<div class="section-title">BAIT STATION DETAILS - OUTSIDE (${outside.length})</div>
${this.renderStationTable(outside)}
`;
  }

  private renderStationTable(stations: any[]) {
    if (!stations.length) return '<div>No stations recorded.</div>';

    return `
<table class="data-table">
  <tr>
    <th>No</th>
    <th>Bait Status</th>
    <th>Activity</th>
    <th>Chemical</th>
    <th>Qty</th>
    <th>Station Condition</th>
    <th>Warning Sign</th>
    <th>Remarks</th>
  </tr>
  ${stations.map((station) => this.renderStationRow(station)).join('')}
</table>`;
  }

  private renderStationRow(station: any) {
    const activityText = this.getActivityText(station);
    const chemicals = Array.isArray(station.station_chemicals) ? station.station_chemicals : [];
    const chemicalText = chemicals.length > 0
      ? chemicals.map((chem: any) => this.escapeHtml(chem.chemical_name || '-')).join('<br/>')
      : this.escapeHtml(station.chemical_name || '-');

    const qtyText = chemicals.length > 0
      ? chemicals.map((chem: any) => {
        const hasQty = Number.isFinite(Number(chem.quantity));
        if (!hasQty) return '-';
        const qty = this.formatNumber0(chem.quantity);
        const unit = chem.unit || chem.quantity_unit || '';
        return `${qty}${unit}`.trim();
      }).join('<br/>')
      : station.quantity
        ? `${this.formatNumber0(station.quantity)}${station.quantity_unit || 'g'}`
        : '-';

    const warningSign = station.warning_sign_condition || station.warning_sign || '-';
    const remarks = station.station_remarks || station.remarks || '-';

    const isAccessible = station.is_accessible !== false && station.is_accessible !== 0;
    if (!isAccessible) {
      const remarkText = remarks && remarks !== '-' ? `Not accessible - ${this.escapeHtml(remarks)}` : 'Not accessible';
      return `
<tr>
  <td>${this.escapeHtml(station.station_number || '-')}</td>
  <td colspan="7">${remarkText}</td>
</tr>`;
    }

    return `
<tr>
  <td>${this.escapeHtml(station.station_number || '-')}</td>
  <td>${station.bait_status === 'none' ? 'N/A' : this.escapeHtml(station.bait_status || '-')}</td>
  <td>${this.escapeHtml(activityText)}</td>
  <td>${chemicalText}</td>
  <td>${this.escapeHtml(qtyText)}</td>
  <td>${this.escapeHtml(station.station_condition || '-')}</td>
  <td>${this.escapeHtml(warningSign)}</td>
  <td>${this.escapeHtml(remarks)}</td>
</tr>`;
  }

  private renderChemicalUsage(stations: any[]) {
    const chemicalMap = new Map<string, { lNumber: string; batchNumber: string; quantity: number; unit: string; stations: number }>();

    stations.forEach((station) => {
      const chemicals = Array.isArray(station.station_chemicals) ? station.station_chemicals : [];
      chemicals.forEach((chem: any) => {
        const name = chem.chemical_name || station.chemical_name;
        if (!name) return;
        const key = name;
        if (!chemicalMap.has(key)) {
          chemicalMap.set(key, {
            lNumber: chem.l_number || station.l_number || 'N/A',
            batchNumber: chem.batch_number || station.batch_number || 'N/A',
            quantity: 0,
            unit: chem.unit || chem.quantity_unit || station.quantity_unit || 'g',
            stations: 0
          });
        }

        const entry = chemicalMap.get(key)!;
        const qty = Number(chem.quantity || station.quantity || 0);
        entry.quantity += Number.isFinite(qty) ? qty : 0;
        entry.stations += 1;
      });
    });

    if (chemicalMap.size === 0) return '';

    const rows = Array.from(chemicalMap.entries()).map(([name, chem]) => {
      const chemName = chem.lNumber !== 'N/A' ? `${name} (L${chem.lNumber})` : name;
      return `
<tr>
  <td>${this.escapeHtml(chemName)}</td>
  <td>${this.escapeHtml(chem.batchNumber)}</td>
  <td>${this.formatNumber0(chem.quantity)} ${this.escapeHtml(chem.unit)}</td>
  <td>${this.formatNumber0(chem.stations)}</td>
</tr>`;
    }).join('');

    return `
<div class="section-title">Chemical Usage Summary</div>
<table class="data-table">
  <tr>
    <th>Chemical Name</th>
    <th>Batch Number</th>
    <th>Total Quantity</th>
    <th>Stations Used</th>
  </tr>
  ${rows}
</table>`;
  }

  private renderRemarks(report: any) {
    if (!report.general_remarks && !report.recommendations && !report.next_service_date) {
      return '';
    }

    return `
<div style="margin-top:10px;"></div>
<div class="section-title">Overall Remarks & Recommendations</div>
<div style="margin-bottom:6px;"><strong>Technician Remarks:</strong></div>
<div class="remarks-box">${this.escapeHtml(report.general_remarks || '')}</div>
<div style="margin-top:8px; margin-bottom:6px;"><strong>Recommendations:</strong></div>
<div class="rec-box">${this.escapeHtml(report.recommendations || '')}</div>
<div style="margin-top:8px;"><strong>Next Service:</strong> ${this.formatDate(report.next_service_date) || 'Not scheduled'}</div>
`;
  }

  private renderClientSignature(report: any) {
    const signatureHtml = this.renderSignatureImage(report.client_signature_data, 190, 40);
    return `
<div style="margin-top:12px;">
  <div><strong>Client Signature:</strong></div>
  <div style="margin-top:4px;">${signatureHtml || '<div class="signature-box"></div>'}</div>
  <div style="margin-top:4px;">${this.escapeHtml(report.client_signature_name || 'Name: ___________________________')}</div>
  <div style="font-size:7pt; color:#666;">Date: ${this.formatDate(new Date())}</div>
</div>
`;
  }

  private renderFooter() {
    return `
<div class="footer">
  <div><strong>KPS Pest Control</strong></div>
  <div>3B Hamman Street, Posbus 247, Groblersdal 0470</div>
  <div>Cell: 082 835 4538 | Adm/Fin: 084 584 0157 | Email: kontakkps@gmail.com</div>
  <div>Generated on ${this.formatDateTime(new Date())}</div>
</div>`;
  }

  private renderFumigationTreatment(areas: any[], pests: any[], treatments: any[]) {
    const areaLines = areas.map((area: any) => `- ${this.escapeHtml(area.is_other ? area.other_description : area.area_name || '-')}`).join('<br/>') || '-';
    const pestLines = pests.map((pest: any) => `- ${this.escapeHtml(pest.is_other ? pest.other_description : (pest.pest_name || pest.pest_type || 'N/A'))}`).join('<br/>') || '-';

    const treatmentRows = treatments.map((treatment: any) => `
<tr>
  <td>${this.escapeHtml(treatment.chemical_name || '-')}</td>
  <td>${this.escapeHtml(treatment.l_number || '-')}</td>
  <td>${this.escapeHtml(treatment.quantity || '-')}</td>
  <td>${this.escapeHtml(treatment.batch_number || '-')}</td>
</tr>`).join('');

    const noTreatmentNote = treatments.length === 0
      ? '<div class="fumigation-note">No fumigation treatment was applied.</div>'
      : '';

    return `
<div class="section-title-red">FUMIGATION TREATMENT</div>
${noTreatmentNote}
<table class="data-table fumigation-table">
  <tr>
    <th style="width:50%">Treated Areas</th>
    <th style="width:50%">Treated For (Target Pests)</th>
  </tr>
  <tr>
    <td>${areaLines}</td>
    <td>${pestLines}</td>
  </tr>
</table>
<table class="data-table fumigation-table">
  <tr>
    <th>Chemical Name</th>
    <th>L Number</th>
    <th>Quantity</th>
    <th>Batch Number</th>
  </tr>
  ${treatmentRows || '<tr><td colspan="4">No fumigation treatment was applied.</td></tr>'}
</table>
`;
  }

  private renderInsectMonitoring(monitors: any[]) {
    if (!monitors.length) return '';

    const lightMonitors = monitors.filter(m => m.monitor_type?.toLowerCase() === 'light');
    const boxMonitors = monitors.filter(m => m.monitor_type?.toLowerCase() === 'box');

    if (!lightMonitors.length && !boxMonitors.length) return '';

    const lightRows = lightMonitors.map((monitor: any) => {
      const lightStatus = (monitor.light_condition || 'na').toLowerCase();
      const lightDisplay = lightStatus === 'good'
        ? 'Good'
        : lightStatus === 'faulty'
          ? `Faulty${monitor.light_faulty_type && monitor.light_faulty_type !== 'na' ? ` (${this.escapeHtml(monitor.light_faulty_type)})` : ''}`
          : 'N/A';

      return `
<tr>
  <td>${this.escapeHtml(monitor.monitor_number || '-')}</td>
  <td>${this.escapeHtml(monitor.location || '-')}</td>
  <td>${this.escapeHtml(monitor.monitor_condition || '-')}</td>
  <td>${lightDisplay}</td>
  <td>${monitor.tubes_replaced ? 'Replaced' : 'Good'}</td>
  <td>${this.escapeHtml(monitor.glue_board_replaced > 0 ? `${monitor.glue_board_replaced} replaced` : 'None')}</td>
  <td>${this.escapeHtml(monitor.warning_sign_condition || '-')}</td>
  <td>${monitor.monitor_serviced ? 'Yes' : 'No'}</td>
  <td>${monitor.is_new_addition ? 'Yes' : 'No'}</td>
</tr>`;
    }).join('');

    const boxRows = boxMonitors.map((monitor: any) => `
<tr>
  <td>${this.escapeHtml(monitor.monitor_number || '-')}</td>
  <td>${this.escapeHtml(monitor.location || '-')}</td>
  <td>${this.escapeHtml(monitor.monitor_condition || '-')}</td>
  <td>${this.escapeHtml(monitor.glue_board_replaced > 0 ? `${monitor.glue_board_replaced} replaced` : 'None')}</td>
  <td>${this.escapeHtml(monitor.warning_sign_condition || '-')}</td>
  <td>${monitor.monitor_serviced ? 'Yes' : 'No'}</td>
  <td>${monitor.is_new_addition ? 'Yes' : 'No'}</td>
</tr>`).join('');

    // Equipment totals summary calculations
    const newMonitors = monitors.filter(m => m.is_new_addition).length;
    const faultyLights = lightMonitors.filter(m => (m.light_condition || '').toLowerCase() === 'faulty').length;
    const tubesReplaced = lightMonitors.filter(m => m.tubes_replaced).length;
    const lightGlueBoardsReplaced = lightMonitors.reduce((sum: number, m: any) => sum + (m.glue_board_replaced || 0), 0);
    const boxGlueBoardsReplaced = boxMonitors.reduce((sum: number, m: any) => sum + (m.glue_board_replaced || 0), 0);
    const totalGlueBoardsReplaced = lightGlueBoardsReplaced + boxGlueBoardsReplaced;
    const warningSignsServiced = monitors.filter(m => {
      const wsc = (m.warning_sign_condition || 'good').toLowerCase();
      return wsc !== 'good';
    }).length;

    const lightSection = lightMonitors.length ? `
<div style="margin-top:6px;" class="fumigation-label">LIGHT TRAPS (${lightMonitors.length})</div>
<table class="data-table fumigation-table">
  <tr>
    <th>No</th>
    <th>Location</th>
    <th>Condition</th>
    <th>Light Status</th>
    <th>Tubes</th>
    <th>Glue Board</th>
    <th>Warning Sign</th>
    <th>Serviced</th>
    <th>New</th>
  </tr>
  ${lightRows}
</table>` : '';

    const boxSection = boxMonitors.length ? `
<div style="margin-top:6px;" class="fumigation-label">BOX MONITORS (${boxMonitors.length})</div>
<table class="data-table fumigation-table">
  <tr>
    <th>No</th>
    <th>Location</th>
    <th>Condition</th>
    <th>Glue Board</th>
    <th>Warning Sign</th>
    <th>Serviced</th>
    <th>New</th>
  </tr>
  ${boxRows}
</table>` : '';

    const summarySection = `
<div style="margin-top:8px;" class="fumigation-label">EQUIPMENT SUMMARY</div>
<table class="data-table fumigation-table">
  <tr>
    <th style="width:55%">Equipment</th>
    <th style="width:25%">Notes</th>
    <th style="width:20%">Total</th>
  </tr>
  <tr>
    <td>New Monitors Installed</td>
    <td style="font-size:6.5pt;color:#555;">Light &amp; Box</td>
    <td><strong>${newMonitors}</strong></td>
  </tr>
  ${lightMonitors.length ? `<tr>
    <td>Faulty Lights</td>
    <td style="font-size:6.5pt;color:#555;">Light traps only</td>
    <td><strong>${faultyLights}</strong></td>
  </tr>` : ''}
  ${lightMonitors.length ? `<tr>
    <td>Tubes Replaced</td>
    <td style="font-size:6.5pt;color:#555;">Light traps only</td>
    <td><strong>${tubesReplaced}</strong></td>
  </tr>` : ''}
  <tr>
    <td>Glue Boards Replaced</td>
    <td style="font-size:6.5pt;color:#555;">${lightMonitors.length && boxMonitors.length ? `Light (${lightGlueBoardsReplaced}) + Box (${boxGlueBoardsReplaced})` : lightMonitors.length ? `Light monitors` : `Box monitors`}</td>
    <td><strong>${totalGlueBoardsReplaced}</strong></td>
  </tr>
  <tr>
    <td>Warning Signs Serviced</td>
    <td style="font-size:6.5pt;color:#555;">Replaced / Repaired / Remounted</td>
    <td><strong>${warningSignsServiced}</strong></td>
  </tr>
  <tr style="background:#3a0f16;">
    <td colspan="2"><strong style="color:#fff;">Total Monitors Serviced</strong></td>
    <td><strong style="color:#fff;">${monitors.filter(m => m.monitor_serviced).length} / ${monitors.length}</strong></td>
  </tr>
</table>`;

    return `
<div class="section-title-red">INSECT MONITORING</div>
${lightSection}
${boxSection}
${summarySection}
`;
  }

  private renderAerosolUnits(units: any[]) {
    if (!units || !units.length) return '';

    const formatAction = (action: string) => {
      switch (action) {
        case 'battery_changed': return 'Battery Changed';
        case 'aerosol_changed': return 'Aerosol Changed';
        case 'aerosol_changed and battery_changed': return 'Aerosol + Battery Changed';
        case 'unit_replaced': return 'Unit Replaced';
        default: return this.escapeHtml(action || '-');
      }
    };

    const rows = units.map((unit: any) => `
<tr>
  <td>${this.escapeHtml(unit.unit_number || '-')}</td>
  <td>${formatAction(unit.action_taken)}</td>
  <td>${this.escapeHtml(unit.chemical_name || (unit.chemical_id ? `Chemical #${unit.chemical_id}` : '-'))}</td>
  <td>${unit.chemical_quantity ? unit.chemical_quantity : '-'}</td>
  <td>${this.escapeHtml(unit.chemical_batch_number || '-')}</td>
  <td>${unit.is_new_addition ? 'Yes' : 'No'}</td>
</tr>`).join('');

    const newUnits = units.filter(u => u.is_new_addition).length;
    const aerosolChanged = units.filter(u => u.action_taken === 'aerosol_changed' || u.action_taken === 'aerosol_changed and battery_changed').length;
    const batteriesChanged = units.filter(u => u.action_taken === 'battery_changed' || u.action_taken === 'aerosol_changed and battery_changed').length;
    const unitsReplaced = units.filter(u => u.action_taken === 'unit_replaced').length;

    return `
<div class="section-title-red">AEROSOL UNITS (${units.length})</div>
<table class="data-table fumigation-table">
  <tr>
    <th>Unit No.</th>
    <th>Action Taken</th>
    <th>Chemical Used</th>
    <th>Qty</th>
    <th>Batch No.</th>
    <th>New</th>
  </tr>
  ${rows}
</table>
<div style="margin-top:8px;" class="fumigation-label">AEROSOL SUMMARY</div>
<table class="data-table fumigation-table">
  <tr><td>Aerosols Changed</td><td><strong>${aerosolChanged}</strong></td></tr>
  <tr><td>Batteries Changed</td><td><strong>${batteriesChanged}</strong></td></tr>
  <tr><td>Units Replaced</td><td><strong>${unitsReplaced}</strong></td></tr>
  <tr><td>New Units Installed</td><td><strong>${newUnits}</strong></td></tr>
  <tr style="background:#3a0f16;"><td><strong style="color:#fff;">Total Units Serviced</strong></td><td><strong style="color:#fff;">${units.length}</strong></td></tr>
</table>
`;
  }

  private renderSignatureImage(data: string | null | undefined, width: number, height: number) {
    const buffer = this.decodeImageData(data || '');
    if (!buffer) return '';
    const base64 = buffer.toString('base64');
    return `<img src="data:image/png;base64,${base64}" style="width:${width}px;height:${height}px;object-fit:contain;" />`;
  }

  private getActivityText(station: any) {
    if (station.activity_description) return station.activity_description;
    if (station.activity_type) return station.activity_type;

    const activityTypes = [];
    if (station.activity_droppings) activityTypes.push('Droppings');
    if (station.activity_gnawing) activityTypes.push('Gnawing');
    if (station.activity_tracks) activityTypes.push('Tracks');

    if (activityTypes.length) return activityTypes.join(', ');
    return station.activity_detected ? 'Yes' : 'None';
  }

  private async getLogoDataUrl(): Promise<string | null> {
    if (this.cachedLogoDataUrl !== null) return this.cachedLogoDataUrl;

    try {
      const buffer = await fs.readFile(this.logoPath);
      const base64 = buffer.toString('base64');
      this.cachedLogoDataUrl = `data:image/png;base64,${base64}`;
      return this.cachedLogoDataUrl;
    } catch {
      this.cachedLogoDataUrl = null;
      return null;
    }
  }

  private formatDate(dateValue: any): string {
    if (!dateValue) return '';
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-ZA');
  }

  private formatDateWithWeek(dateValue: any): string {
    const formatted = this.formatDate(dateValue);
    if (!formatted) return '';
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (Number.isNaN(date.getTime())) return formatted;
    const weekNumber = this.getIsoWeekNumber(date);
    return `${formatted} - week ${weekNumber}`;
  }

  private formatDateTime(dateValue: any): string {
    if (!dateValue) return '';
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('en-ZA');
  }

  private getIsoWeekNumber(date: Date): string {
    const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayOfWeek = utcDate.getUTCDay() || 7;
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayOfWeek);
    const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
    const weekNumber = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return String(weekNumber).padStart(2, '0');
  }

  private formatNumber0(value: any): string {
    const num = Number(value);
    if (!Number.isFinite(num)) return '0';
    return Math.round(num).toString();
  }

  private escapeHtml(value: any): string {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private async getCompleteReportData(reportId: number): Promise<ReportData> {
    const report = await executeQuerySingle(`
      SELECT 
        r.*,
        c.company_name as client_name,
        c.address_line1,
        c.address_line2,
        c.city,
        c.state,
        c.postal_code,
        u.name as pco_name,
        u.pco_number,
        u.phone as pco_phone
      FROM reports r
      INNER JOIN clients c ON r.client_id = c.id
      LEFT JOIN users u ON r.pco_id = u.id
      WHERE r.id = ?
    `, [reportId]);
    if (!report) {
      throw new Error('Report not found');
    }

    report.client_address = [
      report.address_line1,
      report.address_line2,
      report.city,
      report.state,
      report.postal_code
    ].filter(Boolean).join(', ') || 'No address';

    const [baitStations, fumigationTreatments, fumigationAreas, fumigationPests, insectMonitors, aerosolUnits] = await Promise.all([
      this.getBaitStations(reportId),
      this.getFumigationTreatments(reportId),
      this.getFumigationAreas(reportId),
      this.getFumigationPests(reportId),
      this.getInsectMonitors(reportId),
      this.getAerosolUnits(reportId)
    ]);

    const analytics = this.calculateAnalytics(baitStations);

    return {
      report,
      baitStations,
      fumigationTreatments,
      fumigationAreas,
      fumigationPests,
      insectMonitors,
      aerosolUnits,
      analytics
    };
  }

  private async getBaitStations(reportId: number) {
    try {
      const stations = await executeQuery(`
        SELECT 
          bs.*
        FROM bait_stations bs
        WHERE bs.report_id = ?
        ORDER BY bs.location, CAST(bs.station_number AS UNSIGNED)
      `, [reportId]);

      if (!stations.length) return [];

      const stationIds = stations.map((station: any) => station.id);
      if (stationIds.length === 0) {
        return stations.map((station: any) => ({
          ...station,
          station_chemicals: []
        }));
      }

      const placeholders = stationIds.map(() => '?').join(', ');
      const chemicals = await executeQuery(`
        SELECT 
          sc.*,
          c.name as chemical_name,
          c.l_number,
          c.quantity_unit
        FROM station_chemicals sc
        LEFT JOIN chemicals c ON sc.chemical_id = c.id
        WHERE sc.station_id IN (${placeholders})
      `, stationIds);

      const chemicalsByStation = new Map<number, any[]>();
      chemicals.forEach((chem: any) => {
        if (!chemicalsByStation.has(chem.station_id)) {
          chemicalsByStation.set(chem.station_id, []);
        }
        chemicalsByStation.get(chem.station_id)!.push(chem);
      });

      return stations.map((station: any) => ({
        ...station,
        station_chemicals: chemicalsByStation.get(station.id) || []
      }));
    } catch (error) {
      logger.warn('bait_stations table query failed', { reportId, error });
      return [];
    }
  }

  private async getFumigationTreatments(reportId: number) {
    try {
      return await executeQuery(`
        SELECT 
          fc.*,
          c.name as chemical_name,
          c.l_number,
          c.quantity_unit
        FROM fumigation_chemicals fc
        LEFT JOIN chemicals c ON fc.chemical_id = c.id
        WHERE fc.report_id = ?
        ORDER BY c.name
      `, [reportId]);
    } catch (error) {
      logger.warn('fumigation_treatments table query failed', { reportId, error });
      return [];
    }
  }

  private async getFumigationAreas(reportId: number) {
    try {
      return await executeQuery(`
        SELECT *
        FROM fumigation_areas
        WHERE report_id = ?
        ORDER BY area_name
      `, [reportId]);
    } catch (error) {
      logger.warn('fumigation_areas table query failed', { reportId, error });
      return [];
    }
  }

  private async getFumigationPests(reportId: number) {
    try {
      return await executeQuery(`
        SELECT *
        FROM fumigation_target_pests
        WHERE report_id = ?
        ORDER BY pest_name
      `, [reportId]);
    } catch (error) {
      logger.warn('fumigation_pests table query failed', { reportId, error });
      return [];
    }
  }

  private async getInsectMonitors(reportId: number) {
    try {
      return await executeQuery('SELECT * FROM insect_monitors WHERE report_id = ?', [reportId]);
    } catch (error) {
      logger.warn('insect_monitors table query failed', { reportId, error });
      return [];
    }
  }

  private async getAerosolUnits(reportId: number) {
    try {
      return await executeQuery(
        `SELECT au.*, ch.name as chemical_name
         FROM aerosol_units au
         LEFT JOIN chemicals ch ON au.chemical_id = ch.id
         WHERE au.report_id = ?
         ORDER BY au.id`,
        [reportId]
      );
    } catch (error) {
      logger.warn('aerosol_units table query failed', { reportId, error });
      return [];
    }
  }

  private calculateAnalytics(baitStations: any[]) {
    const inside = baitStations.filter(s => (s.location || s.location_type || '').toLowerCase() === 'inside').length;
    const outside = baitStations.filter(s => (s.location || s.location_type || '').toLowerCase() === 'outside').length;
    const active = baitStations.filter(s => (s.bait_status || '').toLowerCase() === 'eaten' || s.rodent_activity === true || s.rodent_activity === 1).length;

    return {
      totalBaitStations: baitStations.length,
      insideBaitStations: inside,
      outsideBaitStations: outside,
      activeBaitStations: active
    };
  }

  private calculateStatusSummary(stations: any[]) {
    const summary: any = {
      eaten: { total: 0, inside: 0, outside: 0, totalPercent: 0, insidePercent: 0, outsidePercent: 0 },
      clean: { total: 0, inside: 0, outside: 0, totalPercent: 0, insidePercent: 0, outsidePercent: 0 },
      wet: { total: 0, inside: 0, outside: 0, totalPercent: 0, insidePercent: 0, outsidePercent: 0 },
      old: { total: 0, inside: 0, outside: 0, totalPercent: 0, insidePercent: 0, outsidePercent: 0 },
      none: { total: 0, inside: 0, outside: 0, totalPercent: 0, insidePercent: 0, outsidePercent: 0 },
      insideTotal: 0,
      outsideTotal: 0,
      totalAccessible: 0,
      infectionRate: 0,
      insideInfectionRate: 0,
      outsideInfectionRate: 0
    };

    const accessibleStations = stations.filter(s => s.is_accessible !== false && s.is_accessible !== 0);
    const total = accessibleStations.length || 1;
    let insideTotal = 0;
    let outsideTotal = 0;
    let affectedStations = 0;
    let insideAffectedStations = 0;
    let outsideAffectedStations = 0;
    const affectedStatuses = new Set(['wet', 'eaten', 'old']);

    accessibleStations.forEach(station => {
      const status = (station.bait_status?.toLowerCase() || 'clean');
      const location = (station.location || station.location_type || '').toLowerCase();
      const isAffected = affectedStatuses.has(status);

      if (summary[status]) {
        summary[status].total++;
        if (location === 'inside') {
          summary[status].inside++;
          insideTotal++;
          if (isAffected) insideAffectedStations++;
        } else {
          summary[status].outside++;
          outsideTotal++;
          if (isAffected) outsideAffectedStations++;
        }
      }

      if (isAffected) affectedStations++;
    });

    summary.insideTotal = insideTotal;
    summary.outsideTotal = outsideTotal;
    summary.totalAccessible = accessibleStations.length;

    Object.keys(summary).forEach(status => {
      if (status !== 'insideTotal' && status !== 'outsideTotal' && status !== 'totalAccessible'
        && status !== 'infectionRate' && status !== 'insideInfectionRate' && status !== 'outsideInfectionRate') {
        const key = status as keyof typeof summary;
        summary[key].totalPercent = (summary[key].total / total) * 100;
        summary[key].insidePercent = insideTotal > 0 ? (summary[key].inside / insideTotal) * 100 : 0;
        summary[key].outsidePercent = outsideTotal > 0 ? (summary[key].outside / outsideTotal) * 100 : 0;
      }
    });

    summary.infectionRate = (affectedStations / total) * 100;
    summary.insideInfectionRate = insideTotal > 0 ? (insideAffectedStations / insideTotal) * 100 : 0;
    summary.outsideInfectionRate = outsideTotal > 0 ? (outsideAffectedStations / outsideTotal) * 100 : 0;

    return summary;
  }

  private decodeImageData(data: string): Buffer | null {
    if (!data || typeof data !== 'string') return null;
    const trimmed = data.trim();
    const match = trimmed.match(/^data:image\/\w+;base64,(.+)$/i);
    const base64 = match ? match[1] : trimmed;

    try {
      return Buffer.from(base64, 'base64');
    } catch {
      return null;
    }
  }

  private formatReportType(reportType: string | null | undefined): string {
    if (!reportType) return 'Bait Inspection';
    if (reportType === 'both') return 'Rodent Inspection & Fumigation';
    if (reportType === 'bait_inspection') return 'Bait Inspection';
    if (reportType === 'fumigation') return 'Fumigation';
    return reportType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export const pdfService = new PDFService();
