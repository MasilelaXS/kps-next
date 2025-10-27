/**
 * KPS Pest Control Management System - PDF Service
 * 
 * Generates PDF reports for bait inspection and fumigation services
 * 
 * @author KPS Development Team
 * @version 1.0.0
 */

import puppeteer from 'puppeteer';
import { executeQuery, executeQuerySingle } from '../config/database';
import { logger } from '../config/logger';
import path from 'path';
import fs from 'fs/promises';

interface ReportData {
  report: any;
  baitStations: any[];
  fumigationTreatments: any[];
  fumigationAreas: any[];
  fumigationPests: any[];
  insectMonitors: any[];
  analytics: any;
}

export class PDFService {
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(__dirname, '../../temp/reports');
    this.ensureTempDirectory();
  }

  private async ensureTempDirectory() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create temp directory', { error });
    }
  }

  private async cleanupOldFiles() {
    try {
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();
      const maxAge = 60 * 60 * 1000; // 1 hour

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

  private async getLogoBase64(): Promise<string> {
    try {
      const logoPath = path.join(__dirname, '../../../public/logo.png');
      const logoBuffer = await fs.readFile(logoPath);
      return `data:image/png;base64,${logoBuffer.toString('base64')}`;
    } catch (error) {
      logger.error('Failed to load logo', { error });
      return ''; // Return empty string if logo not found
    }
  }

  /**
   * Generate PDF report for a given report ID
   */
  async generateReportPDF(reportId: number): Promise<string> {
    await this.cleanupOldFiles();

    try {
      logger.info('Starting PDF generation', { reportId });
      const data = await this.getCompleteReportData(reportId);
      logger.info('Report data retrieved', { 
        reportId, 
        reportType: data.report.report_type,
        fumigationAreas: data.fumigationAreas?.length || 0,
        fumigationPests: data.fumigationPests?.length || 0,
        insectMonitors: data.insectMonitors?.length || 0
      });
      
      let html = '';
      let filename = '';

      // Generate appropriate report based on type
      if (data.report.report_type === 'bait_inspection') {
        logger.info('Generating bait inspection HTML', { reportId });
        html = await this.generateBaitInspectionHTML(data);
        filename = `Bait_Inspection_Report_${reportId}_${Date.now()}.pdf`;
      } else if (data.report.report_type === 'fumigation') {
        logger.info('Generating fumigation HTML', { reportId });
        html = await this.generateFumigationHTML(data);
        filename = `Fumigation_Report_${reportId}_${Date.now()}.pdf`;
      } else if (data.report.report_type === 'both') {
        logger.info('Generating combined report HTML', { reportId });
        html = await this.generateCombinedReportHTML(data);
        filename = `Complete_Report_${reportId}_${Date.now()}.pdf`;
      } else {
        throw new Error('Invalid report type');
      }

      logger.info('Launching Puppeteer browser', { reportId });
      // Generate PDF using Puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const filePath = path.join(this.tempDir, filename);
      
      await page.pdf({
        path: filePath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '15mm',
          right: '10mm',
          bottom: '15mm',
          left: '10mm'
        }
      });

      await browser.close();

      logger.info('PDF generated successfully', { reportId, filename });
      
      return filePath;

    } catch (error) {
      logger.error('PDF generation error', { reportId, error });
      throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getCompleteReportData(reportId: number): Promise<ReportData> {
    // Get main report data
    const report = await executeQuerySingle(`
      SELECT 
        r.*,
        c.company_name as client_name,
        c.address_line1,
        c.address_line2,
        c.city,
        c.state,
        c.postal_code,
        c.total_bait_stations_inside,
        c.total_bait_stations_outside,
        c.total_insect_monitors_light,
        c.total_insect_monitors_box,
        u.name as pco_name,
        u.pco_number,
        u.email as pco_email,
        u.phone as pco_phone
      FROM reports r
      INNER JOIN clients c ON r.client_id = c.id
      LEFT JOIN users u ON r.pco_id = u.id
      WHERE r.id = ?
    `, [reportId]);

    if (!report) {
      throw new Error('Report not found');
    }

    // Get bait stations with chemicals
    const baitStations = await executeQuery(`
      SELECT 
        bs.*,
        sc.chemical_id,
        sc.quantity,
        sc.batch_number,
        c.name as chemical_name,
        c.l_number,
        c.quantity_unit
      FROM bait_stations bs
      LEFT JOIN station_chemicals sc ON bs.id = sc.station_id
      LEFT JOIN chemicals c ON sc.chemical_id = c.id
      WHERE bs.report_id = ?
      ORDER BY bs.location, bs.station_number
    `, [reportId]);

    // Get fumigation chemicals
    const fumigationTreatments = await executeQuery(`
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

    // Get fumigation areas
    const fumigationAreas = await executeQuery(`
      SELECT *
      FROM fumigation_areas
      WHERE report_id = ?
      ORDER BY area_name
    `, [reportId]);

    // Get fumigation target pests
    const fumigationPests = await executeQuery(`
      SELECT *
      FROM fumigation_target_pests
      WHERE report_id = ?
      ORDER BY pest_name
    `, [reportId]);

    // Get insect monitors
    const insectMonitors = await executeQuery(`
      SELECT *
      FROM insect_monitors
      WHERE report_id = ?
      ORDER BY location, monitor_number, monitor_type, id
    `, [reportId]);

    // Calculate analytics
    const analytics = this.calculateAnalytics(baitStations, insectMonitors);

    return {
      report,
      baitStations,
      fumigationTreatments,
      fumigationAreas,
      fumigationPests,
      insectMonitors,
      analytics
    };
  }

  private calculateAnalytics(baitStations: any[], insectMonitors: any[]) {
    const analytics: any = {
      totalBaitStations: baitStations.length,
      insideBaitStations: baitStations.filter(bs => bs.location === 'inside').length,
      outsideBaitStations: baitStations.filter(bs => bs.location === 'outside').length,
      activeBaitStations: baitStations.filter(bs => bs.bait_status === 'eaten').length,
      totalInsectMonitors: insectMonitors.length,
      insideMonitors: insectMonitors.filter(im => im.location?.toLowerCase() === 'inside').length,
      outsideMonitors: insectMonitors.filter(im => im.location?.toLowerCase() === 'outside').length,
      baitStatusSummary: {
        eaten: 0,
        clean: 0,
        wet: 0,
        old: 0
      },
      chemicalUsage: {} as Record<string, { quantity: number; unit: string; stations: number }>
    };

    // Calculate bait status summary
    baitStations.forEach(station => {
      const status = station.bait_status || 'clean';
      if (analytics.baitStatusSummary[status] !== undefined) {
        analytics.baitStatusSummary[status]++;
      }

      // Track chemical usage
      if (station.chemical_name && station.quantity_used > 0) {
        const key = `${station.chemical_name} (${station.l_number})`;
        if (!analytics.chemicalUsage[key]) {
          analytics.chemicalUsage[key] = {
            quantity: 0,
            unit: station.quantity_unit || 'g',
            stations: 0
          };
        }
        analytics.chemicalUsage[key].quantity += parseFloat(station.quantity_used);
        analytics.chemicalUsage[key].stations++;
      }
    });

    // Calculate infection rate
    if (analytics.totalBaitStations > 0) {
      analytics.infectionRate = ((analytics.activeBaitStations / analytics.totalBaitStations) * 100).toFixed(2);
    } else {
      analytics.infectionRate = '0.00';
    }

    return analytics;
  }

  private calculateBaitStatusSummary(stations: any[]) {
    const summary: Record<string, number> = {
      eaten: 0,
      clean: 0,
      wet: 0,
      old: 0,
      total: 0
    };

    const locationSummary: Record<string, Record<string, number>> = {
      inside: { eaten: 0, clean: 0, wet: 0, old: 0, total: 0 },
      outside: { eaten: 0, clean: 0, wet: 0, old: 0, total: 0 }
    };

    // Count each bait status for accessible stations only
    stations.forEach(station => {
      if (station.is_accessible === 1) {
        const baitStatus = station.bait_status || 'clean';
        const location = station.location?.toLowerCase() === 'outside' ? 'outside' : 'inside';

        if (summary[baitStatus] !== undefined) {
          summary[baitStatus]++;
          locationSummary[location][baitStatus]++;
        }
        summary.total++;
        locationSummary[location].total++;
      }
    });

    // Calculate percentages
    const percentages: Record<string, number> = {};
    ['eaten', 'clean', 'wet', 'old'].forEach(status => {
      percentages[status] = summary.total > 0 
        ? Math.round((summary[status] / summary.total) * 1000) / 10
        : 0;
    });

    // Calculate location-specific percentages
    const locationPercentages: Record<string, Record<string, number>> = {};
    ['inside', 'outside'].forEach(location => {
      locationPercentages[location] = {};
      ['eaten', 'clean', 'wet', 'old'].forEach(status => {
        locationPercentages[location][status] = locationSummary[location].total > 0
          ? Math.round((locationSummary[location][status] / locationSummary[location].total) * 1000) / 10
          : 0;
      });
    });

    return {
      counts: summary,
      percentages,
      locations: locationSummary,
      location_percentages: locationPercentages
    };
  }

  private getInfectionLevel(rate: number) {
    if (rate >= 0 && rate <= 5) return { level: 'Low', color: '#28a745' };
    if (rate >= 6 && rate <= 10) return { level: 'Medium', color: '#ffc107' };
    if (rate >= 11 && rate <= 30) return { level: 'High', color: '#fd7e14' };
    return { level: 'Severe', color: '#dc3545' };
  }

  private formatAreaName(name: string) {
    // Convert underscore separated names to properly formatted text
    if (!name) return 'Unknown Area';
    return name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  private escape(value: any): string {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private async generateBaitInspectionHTML(data: ReportData): Promise<string> {
    const { report, baitStations, analytics } = data;
    const logoBase64 = await this.getLogoBase64();
    
    // Calculate comprehensive bait status summary
    const rawSummary = this.calculateBaitStatusSummary(baitStations);
    
    // Transform to easier structure for template
    const statusSummary = {
      eaten: {
        total: rawSummary.counts.eaten,
        totalPercent: rawSummary.percentages.eaten || 0,
        inside: rawSummary.locations.inside.eaten,
        insidePercent: rawSummary.location_percentages.inside.eaten || 0,
        outside: rawSummary.locations.outside.eaten,
        outsidePercent: rawSummary.location_percentages.outside.eaten || 0
      },
      clean: {
        total: rawSummary.counts.clean,
        totalPercent: rawSummary.percentages.clean || 0,
        inside: rawSummary.locations.inside.clean,
        insidePercent: rawSummary.location_percentages.inside.clean || 0,
        outside: rawSummary.locations.outside.clean,
        outsidePercent: rawSummary.location_percentages.outside.clean || 0
      },
      wet: {
        total: rawSummary.counts.wet,
        totalPercent: rawSummary.percentages.wet || 0,
        inside: rawSummary.locations.inside.wet,
        insidePercent: rawSummary.location_percentages.inside.wet || 0,
        outside: rawSummary.locations.outside.wet,
        outsidePercent: rawSummary.location_percentages.outside.wet || 0
      },
      old: {
        total: rawSummary.counts.old,
        totalPercent: rawSummary.percentages.old || 0,
        inside: rawSummary.locations.inside.old,
        insidePercent: rawSummary.location_percentages.inside.old || 0,
        outside: rawSummary.locations.outside.old,
        outsidePercent: rawSummary.location_percentages.outside.old || 0
      },
      insideTotal: rawSummary.locations.inside.total,
      insideActive: rawSummary.locations.inside.eaten,
      insideInfectionRate: rawSummary.locations.inside.total > 0 
        ? (rawSummary.locations.inside.eaten / rawSummary.locations.inside.total) * 100 
        : 0,
      outsideTotal: rawSummary.locations.outside.total,
      outsideActive: rawSummary.locations.outside.eaten,
      outsideInfectionRate: rawSummary.locations.outside.total > 0 
        ? (rawSummary.locations.outside.eaten / rawSummary.locations.outside.total) * 100 
        : 0,
      infectionRate: rawSummary.counts.total > 0 
        ? (rawSummary.counts.eaten / rawSummary.counts.total) * 100 
        : 0
    };
    
    const clientAddress = [
      report.address_line1,
      report.address_line2,
      report.city,
      report.state,
      report.postal_code
    ].filter(Boolean).join(', ');

    // Group stations by location (inside/outside)
    const insideStations = baitStations.filter(s => s.location?.toLowerCase() === 'inside');
    const outsideStations = baitStations.filter(s => s.location?.toLowerCase() === 'outside');
    const inaccessibleStations = baitStations.filter(s => !s.is_accessible || s.station_condition?.toLowerCase() === 'inaccessible');
    
    // Calculate chemical usage with L-numbers and batch numbers
    const chemicalUsageMap = new Map();
    baitStations.forEach(station => {
      if (station.chemical_name && station.quantity) {
        const key = station.chemical_name;
        if (!chemicalUsageMap.has(key)) {
          chemicalUsageMap.set(key, {
            name: station.chemical_name,
            l_number: station.l_number || 'N/A',
            batch_number: station.batch_number || 'N/A',
            quantity: 0,
            unit: station.quantity_unit || 'g',
            stations: 0
          });
        }
        const usage = chemicalUsageMap.get(key);
        usage.quantity += parseFloat(station.quantity.toString());
        usage.stations += 1;
      }
    });
    const chemicalUsageArray = Array.from(chemicalUsageMap.values());

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Bait Inspection Report #${report.id}</title>
    <style>
        body { font-family: 'Calibri', Arial, sans-serif; font-size: 9pt; line-height: 1.3; margin: 0; padding: 20px; color: #000; }
        .header-section { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; padding: 10px 0; border-bottom: 2px solid #1f5582; margin-bottom: 15px; }
        .logo-section h1 { margin: 0; font-size: 16pt; color: #1f5582; font-weight: bold; }
        .logo-section h2 { margin: 3px 0 0 0; font-size: 11pt; color: #666; font-weight: normal; }
        .address-section { text-align: right; font-size: 8pt; color: #666; }
        .address-section p { margin: 1px 0; }
        .report-info { background: #f5f5f5; padding: 8px; margin-bottom: 12px; }
        .info-row { margin: 3px 0; font-size: 8pt; }
        .label { font-weight: bold; display: inline-block; width: 130px; }
        .value { display: inline-block; }
        .section { margin: 12px 0; page-break-inside: avoid; }
        .section-title { background: #1f5582; color: white; padding: 6px 10px; margin: 10px 0 8px 0; font-size: 10pt; font-weight: bold; }
        .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 10px 0; }
        .stat-card { background: #f9f9f9; padding: 8px; text-align: center; border: 1px solid #ddd; }
        .stat-number { font-size: 18pt; font-weight: bold; color: #1f5582; margin: 3px 0; }
        .stat-label { font-size: 7pt; color: #666; }
        .side-by-side { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 10px 0; }
        table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 8pt; }
        th { background: #1f5582; color: white; padding: 5px 6px; text-align: left; font-weight: bold; font-size: 8pt; }
        td { padding: 4px 6px; border: 1px solid #ddd; }
        tr:nth-child(even) { background: #f9f9f9; }
        .status-badge { padding: 2px 6px; border-radius: 2px; font-size: 7pt; font-weight: bold; color: white; }
        .status-approved { background: #28a745; }
        .status-pending { background: #ffc107; color: #333; }
        .status-draft { background: #6c757d; }
        .status-declined { background: #dc3545; }
        .inaccessible-row { background: #ffebee !important; }
        .location-group { margin-top: 12px; page-break-inside: avoid; }
        .location-header { background: #e3f2fd; padding: 5px 8px; font-weight: bold; color: #1f5582; font-size: 9pt; }
        .footer { margin-top: 20px; padding-top: 12px; border-top: 1px solid #999; font-size: 7pt; text-align: center; color: #666; }
        .signature-section { margin: 15px 0; page-break-inside: avoid; }
        .signature-box { text-align: center; }
        .signature-line { border-top: 1px solid #333; margin: 5px auto; width: 250px; }
        h3 { font-size: 10pt; margin: 8px 0 5px 0; color: #1f5582; }
        h4 { font-size: 9pt; margin: 5px 0; }
        p { margin: 3px 0; font-size: 8pt; }
    </style>
</head>
<body>
    <!-- Header with Logo and Address -->
    <div class="header-section">
        <div class="logo-section">
            ${logoBase64 ? `<img src="${logoBase64}" alt="KPS Logo" style="height: 60px; width: auto; margin-bottom: 8px;" />` : ''}
            <h2>BAIT INSPECTION REPORT</h2>
        </div>
        <div class="address-section">
            <p><strong>KPS Pest Control</strong></p>
            <p>3B Hamman Street</p>
            <p>Groblersdal, 0470</p>
            <p>South Africa</p>
        </div>
    </div>

    <!-- Report Details -->
    <div class="report-info">
        <div class="info-row">
            <span class="label">Report ID:</span>
            <span class="value">#${this.escape(report.id)}</span>
        </div>
        <div class="info-row">
            <span class="label">Report Status:</span>
            <span class="value">
                <span class="status-badge status-${this.escape(report.status)}">
                    ${this.escape(report.status).toUpperCase()}
                </span>
            </span>
        </div>
        <div class="info-row">
            <span class="label">Service Date:</span>
            <span class="value">${new Date(report.service_date).toLocaleDateString('en-ZA')}</span>
        </div>
        <div class="info-row">
            <span class="label">Next Service Date:</span>
            <span class="value">${report.next_service_date ? new Date(report.next_service_date).toLocaleDateString('en-ZA') : 'Not scheduled'}</span>
        </div>
        <div class="info-row">
            <span class="label">Generated:</span>
            <span class="value">${new Date().toLocaleString('en-ZA')}</span>
        </div>
    </div>

    <!-- PCO Signature at Top -->
    <div class="signature-section" style="margin-bottom: 20px;">
        <div style="display: inline-block; width: 45%; vertical-align: top;">
            <p style="margin-bottom: 5px; font-weight: bold; font-size: 8pt;">PCO Signature:</p>
            ${report.pco_signature_data ? `
                <div style="border: 1px solid #ddd; padding: 5px; height: 50px; display: flex; align-items: center; justify-content: center;">
                    <img src="${report.pco_signature_data}" alt="PCO Signature" style="max-width: 100%; max-height: 50px; object-fit: contain;" />
                </div>
            ` : `
                <div class="signature-line" style="width: 200px; margin: 0;"></div>
            `}
            <p style="margin-top: 3px; font-size: 8pt;">${this.escape(report.pco_name)}</p>
            <p style="margin-top: 2px; font-size: 7pt; color: #666;">Date: ${new Date(report.service_date).toLocaleDateString('en-ZA')}</p>
        </div>
    </div>

    <!-- PCO and Client Details Side-by-Side -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 12px 0;">
        <div>
            <h3 style="margin: 0 0 5px 0;">Client Details</h3>
            <p style="margin: 3px 0; font-weight: bold;">${this.escape(report.client_name)}</p>
            <p style="margin: 3px 0; font-size: 8pt;">${this.escape(clientAddress)}</p>
        </div>
        <div>
            <h3 style="margin: 0 0 5px 0;">PCO Details</h3>
            <p style="margin: 3px 0; font-weight: bold;">${this.escape(report.pco_name)}</p>
            <p style="margin: 3px 0; font-size: 8pt;">PCO Number: ${this.escape(report.pco_number)}</p>
        </div>
    </div>

    <!-- Analytics Grid: 4 Columns -->
    <div class="section-title">INSPECTION SUMMARY</div>
    <div class="grid">
        <div class="stat-card">
            <div class="stat-number">${analytics.totalBaitStations}</div>
            <div class="stat-label">Total Stations</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${analytics.insideBaitStations}</div>
            <div class="stat-label">Inside Stations</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${analytics.outsideBaitStations}</div>
            <div class="stat-label">Outside Stations</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${analytics.activeBaitStations}</div>
            <div class="stat-label">Activity Detected</div>
        </div>
    </div>

    <!-- Bait Status Summary: 3 Columns (Status, Count, Percentage) -->
    <div class="section">
        <h3 style="color: #1f5582;">Bait Status Summary</h3>
        <table>
            <thead>
                <tr>
                    <th>Bait Status</th>
                    <th style="text-align: center;">Count</th>
                    <th style="text-align: center;">Percentage</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Eaten</strong></td>
                    <td style="text-align: center;">${statusSummary.eaten.total}</td>
                    <td style="text-align: center;">${statusSummary.eaten.totalPercent.toFixed(1)}%</td>
                </tr>
                <tr>
                    <td><strong>Clean</strong></td>
                    <td style="text-align: center;">${statusSummary.clean.total}</td>
                    <td style="text-align: center;">${statusSummary.clean.totalPercent.toFixed(1)}%</td>
                </tr>
                <tr>
                    <td><strong>Wet</strong></td>
                    <td style="text-align: center;">${statusSummary.wet.total}</td>
                    <td style="text-align: center;">${statusSummary.wet.totalPercent.toFixed(1)}%</td>
                </tr>
                <tr>
                    <td><strong>Old</strong></td>
                    <td style="text-align: center;">${statusSummary.old.total}</td>
                    <td style="text-align: center;">${statusSummary.old.totalPercent.toFixed(1)}%</td>
                </tr>
                <tr style="background: #e3f2fd; font-weight: bold;">
                    <td>TOTAL</td>
                    <td style="text-align: center;">${statusSummary.eaten.total + statusSummary.clean.total + statusSummary.wet.total + statusSummary.old.total}</td>
                    <td style="text-align: center;">100.0%</td>
                </tr>
            </tbody>
        </table>
    </div>

    <!-- Location Breakdown: Inside and Outside Side-by-Side -->
    <div class="section">
        <h3 style="color: #1f5582;">Location Breakdown</h3>
        <div class="side-by-side">
            <div>
                <h4 style="margin: 5px 0;">Inside Stations</h4>
                <table>
                    <thead>
                        <tr>
                            <th>Status</th>
                            <th style="text-align: center;">Count</th>
                            <th style="text-align: center;">%</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Eaten</td>
                            <td style="text-align: center;">${statusSummary.eaten.inside}</td>
                            <td style="text-align: center;">${statusSummary.eaten.insidePercent.toFixed(1)}%</td>
                        </tr>
                        <tr>
                            <td>Clean</td>
                            <td style="text-align: center;">${statusSummary.clean.inside}</td>
                            <td style="text-align: center;">${statusSummary.clean.insidePercent.toFixed(1)}%</td>
                        </tr>
                        <tr>
                            <td>Wet</td>
                            <td style="text-align: center;">${statusSummary.wet.inside}</td>
                            <td style="text-align: center;">${statusSummary.wet.insidePercent.toFixed(1)}%</td>
                        </tr>
                        <tr>
                            <td>Old</td>
                            <td style="text-align: center;">${statusSummary.old.inside}</td>
                            <td style="text-align: center;">${statusSummary.old.insidePercent.toFixed(1)}%</td>
                        </tr>
                        <tr style="background: #e3f2fd; font-weight: bold;">
                            <td>TOTAL</td>
                            <td style="text-align: center;">${statusSummary.insideTotal}</td>
                            <td style="text-align: center;">100.0%</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div>
                <h4 style="margin: 5px 0;">Outside Stations</h4>
                <table>
                    <thead>
                        <tr>
                            <th>Status</th>
                            <th style="text-align: center;">Count</th>
                            <th style="text-align: center;">%</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Eaten</td>
                            <td style="text-align: center;">${statusSummary.eaten.outside}</td>
                            <td style="text-align: center;">${statusSummary.eaten.outsidePercent.toFixed(1)}%</td>
                        </tr>
                        <tr>
                            <td>Clean</td>
                            <td style="text-align: center;">${statusSummary.clean.outside}</td>
                            <td style="text-align: center;">${statusSummary.clean.outsidePercent.toFixed(1)}%</td>
                        </tr>
                        <tr>
                            <td>Wet</td>
                            <td style="text-align: center;">${statusSummary.wet.outside}</td>
                            <td style="text-align: center;">${statusSummary.wet.outsidePercent.toFixed(1)}%</td>
                        </tr>
                        <tr>
                            <td>Old</td>
                            <td style="text-align: center;">${statusSummary.old.outside}</td>
                            <td style="text-align: center;">${statusSummary.old.outsidePercent.toFixed(1)}%</td>
                        </tr>
                        <tr style="background: #e3f2fd; font-weight: bold;">
                            <td>TOTAL</td>
                            <td style="text-align: center;">${statusSummary.outsideTotal}</td>
                            <td style="text-align: center;">100.0%</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Rodent Progress Analysis: 5 Columns with Color-Coded Severity -->
    <div class="section">
        <h3 style="color: #1f5582;">Rodent Progress Analysis</h3>
        <table>
            <thead>
                <tr>
                    <th>Location</th>
                    <th style="text-align: center;">Low (0-5%)</th>
                    <th style="text-align: center;">Medium (6-10%)</th>
                    <th style="text-align: center;">High (11-30%)</th>
                    <th style="text-align: center;">Severe (31%+)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Overall</strong></td>
                    <td style="text-align: center; background-color: ${statusSummary.infectionRate <= 5 ? '#4caf50' : '#fff'}; color: ${statusSummary.infectionRate <= 5 ? '#fff' : '#333'};">
                        ${statusSummary.infectionRate <= 5 ? statusSummary.infectionRate.toFixed(1) + '%' : '-'}
                    </td>
                    <td style="text-align: center; background-color: ${statusSummary.infectionRate > 5 && statusSummary.infectionRate <= 10 ? '#ffeb3b' : '#fff'}; color: ${statusSummary.infectionRate > 5 && statusSummary.infectionRate <= 10 ? '#333' : '#333'};">
                        ${statusSummary.infectionRate > 5 && statusSummary.infectionRate <= 10 ? statusSummary.infectionRate.toFixed(1) + '%' : '-'}
                    </td>
                    <td style="text-align: center; background-color: ${statusSummary.infectionRate > 10 && statusSummary.infectionRate <= 30 ? '#ff9800' : '#fff'}; color: ${statusSummary.infectionRate > 10 && statusSummary.infectionRate <= 30 ? '#fff' : '#333'};">
                        ${statusSummary.infectionRate > 10 && statusSummary.infectionRate <= 30 ? statusSummary.infectionRate.toFixed(1) + '%' : '-'}
                    </td>
                    <td style="text-align: center; background-color: ${statusSummary.infectionRate > 30 ? '#f44336' : '#fff'}; color: ${statusSummary.infectionRate > 30 ? '#fff' : '#333'};">
                        ${statusSummary.infectionRate > 30 ? statusSummary.infectionRate.toFixed(1) + '%' : '-'}
                    </td>
                </tr>
                <tr>
                    <td><strong>Inside</strong></td>
                    <td style="text-align: center; background-color: ${statusSummary.insideInfectionRate <= 5 ? '#4caf50' : '#fff'}; color: ${statusSummary.insideInfectionRate <= 5 ? '#fff' : '#333'};">
                        ${statusSummary.insideInfectionRate <= 5 ? statusSummary.insideInfectionRate.toFixed(1) + '%' : '-'}
                    </td>
                    <td style="text-align: center; background-color: ${statusSummary.insideInfectionRate > 5 && statusSummary.insideInfectionRate <= 10 ? '#ffeb3b' : '#fff'};">
                        ${statusSummary.insideInfectionRate > 5 && statusSummary.insideInfectionRate <= 10 ? statusSummary.insideInfectionRate.toFixed(1) + '%' : '-'}
                    </td>
                    <td style="text-align: center; background-color: ${statusSummary.insideInfectionRate > 10 && statusSummary.insideInfectionRate <= 30 ? '#ff9800' : '#fff'}; color: ${statusSummary.insideInfectionRate > 10 && statusSummary.insideInfectionRate <= 30 ? '#fff' : '#333'};">
                        ${statusSummary.insideInfectionRate > 10 && statusSummary.insideInfectionRate <= 30 ? statusSummary.insideInfectionRate.toFixed(1) + '%' : '-'}
                    </td>
                    <td style="text-align: center; background-color: ${statusSummary.insideInfectionRate > 30 ? '#f44336' : '#fff'}; color: ${statusSummary.insideInfectionRate > 30 ? '#fff' : '#333'};">
                        ${statusSummary.insideInfectionRate > 30 ? statusSummary.insideInfectionRate.toFixed(1) + '%' : '-'}
                    </td>
                </tr>
                <tr>
                    <td><strong>Outside</strong></td>
                    <td style="text-align: center; background-color: ${statusSummary.outsideInfectionRate <= 5 ? '#4caf50' : '#fff'}; color: ${statusSummary.outsideInfectionRate <= 5 ? '#fff' : '#333'};">
                        ${statusSummary.outsideInfectionRate <= 5 ? statusSummary.outsideInfectionRate.toFixed(1) + '%' : '-'}
                    </td>
                    <td style="text-align: center; background-color: ${statusSummary.outsideInfectionRate > 5 && statusSummary.outsideInfectionRate <= 10 ? '#ffeb3b' : '#fff'};">
                        ${statusSummary.outsideInfectionRate > 5 && statusSummary.outsideInfectionRate <= 10 ? statusSummary.outsideInfectionRate.toFixed(1) + '%' : '-'}
                    </td>
                    <td style="text-align: center; background-color: ${statusSummary.outsideInfectionRate > 10 && statusSummary.outsideInfectionRate <= 30 ? '#ff9800' : '#fff'}; color: ${statusSummary.outsideInfectionRate > 10 && statusSummary.outsideInfectionRate <= 30 ? '#fff' : '#333'};">
                        ${statusSummary.outsideInfectionRate > 10 && statusSummary.outsideInfectionRate <= 30 ? statusSummary.outsideInfectionRate.toFixed(1) + '%' : '-'}
                    </td>
                    <td style="text-align: center; background-color: ${statusSummary.outsideInfectionRate > 30 ? '#f44336' : '#fff'}; color: ${statusSummary.outsideInfectionRate > 30 ? '#fff' : '#333'};">
                        ${statusSummary.outsideInfectionRate > 30 ? statusSummary.outsideInfectionRate.toFixed(1) + '%' : '-'}
                    </td>
                </tr>
            </tbody>
        </table>
    </div>

    <!-- Bait Station Details Grouped by Location -->
    ${baitStations.length > 0 ? `
    <div class="section">
        <div class="section-title">BAIT STATION DETAILS</div>
        
        ${insideStations.length > 0 ? `
        <div class="location-group">
            <div class="location-header">BAIT STATIONS - INSIDE (${insideStations.length})</div>
            <table>
                <thead>
                    <tr>
                        <th>No</th>
                        <th>Bait Status</th>
                        <th>Activity</th>
                        <th>Chemical</th>
                        <th style="text-align: center;">Qty</th>
                        <th>Condition</th>
                    </tr>
                </thead>
                <tbody>
                    ${insideStations.filter(s => s.is_accessible).map(station => {
                      const activityTypes = [];
                      if (station.activity_droppings) activityTypes.push('Droppings');
                      if (station.activity_gnawing) activityTypes.push('Gnawing');
                      if (station.activity_tracks) activityTypes.push('Tracks');
                      const activityText = activityTypes.length > 0 ? activityTypes.join(', ') : (station.activity_detected ? 'Yes' : 'None');
                      
                      return `
                    <tr>
                        <td>${this.escape(station.station_number)}</td>
                        <td>${this.escape(station.bait_status || '-')}</td>
                        <td>${activityText}</td>
                        <td>${this.escape(station.chemical_name || '-')}</td>
                        <td style="text-align: center;">${station.quantity ? `${station.quantity} ${station.quantity_unit || 'g'}` : '-'}</td>
                        <td>${this.escape(station.station_condition || '-')}</td>
                    </tr>
                      `;
                    }).join('')}
                    ${insideStations.filter(s => !s.is_accessible).map(station => `
                    <tr class="inaccessible-row">
                        <td>${this.escape(station.station_number)}</td>
                        <td>Unknown</td>
                        <td colspan="4" style="font-weight: bold; color: #d32f2f;">INACCESSIBLE - ${this.escape(station.inaccessible_reason || 'Reason not specified')}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}
        
        ${outsideStations.length > 0 ? `
        <div class="location-group">
            <div class="location-header">BAIT STATIONS - OUTSIDE (${outsideStations.length})</div>
            <table>
                <thead>
                    <tr>
                        <th>No</th>
                        <th>Bait Status</th>
                        <th>Activity</th>
                        <th>Chemical</th>
                        <th style="text-align: center;">Qty</th>
                        <th>Condition</th>
                    </tr>
                </thead>
                <tbody>
                    ${outsideStations.filter(s => s.is_accessible).map(station => {
                      const activityTypes = [];
                      if (station.activity_droppings) activityTypes.push('Droppings');
                      if (station.activity_gnawing) activityTypes.push('Gnawing');
                      if (station.activity_tracks) activityTypes.push('Tracks');
                      const activityText = activityTypes.length > 0 ? activityTypes.join(', ') : (station.activity_detected ? 'Yes' : 'None');
                      
                      return `
                    <tr>
                        <td>${this.escape(station.station_number)}</td>
                        <td>${this.escape(station.bait_status || '-')}</td>
                        <td>${activityText}</td>
                        <td>${this.escape(station.chemical_name || '-')}</td>
                        <td style="text-align: center;">${station.quantity ? `${station.quantity} ${station.quantity_unit || 'g'}` : '-'}</td>
                        <td>${this.escape(station.station_condition || '-')}</td>
                    </tr>
                      `;
                    }).join('')}
                    ${outsideStations.filter(s => !s.is_accessible).map(station => `
                    <tr class="inaccessible-row">
                        <td>${this.escape(station.station_number)}</td>
                        <td>Unknown</td>
                        <td colspan="4" style="font-weight: bold; color: #d32f2f;">INACCESSIBLE - ${this.escape(station.inaccessible_reason || 'Reason not specified')}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}
    </div>
    ` : ''}

    <!-- Chemical Usage Summary with L-numbers and Batch Numbers -->
    ${chemicalUsageArray.length > 0 ? `
    <div class="section">
        <h3 style="color: #1f5582;">Chemical Usage Summary</h3>
        <table>
            <thead>
                <tr>
                    <th>Chemical Name</th>
                    <th style="text-align: center;">Batch Number</th>
                    <th style="text-align: center;">Total Quantity</th>
                    <th style="text-align: center;">Stations Used</th>
                </tr>
            </thead>
            <tbody>
                ${chemicalUsageArray.map(chem => `
                <tr>
                    <td>${this.escape(chem.name)}${chem.l_number !== 'N/A' ? ` (L${chem.l_number})` : ''}</td>
                    <td style="text-align: center;">${this.escape(chem.batch_number)}</td>
                    <td style="text-align: center;">${chem.quantity.toFixed(2)} ${chem.unit}</td>
                    <td style="text-align: center;">${chem.stations}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}

    <!-- Remarks and Recommendations -->
    ${report.general_remarks || report.recommendations ? `
    <div class="section">
        ${report.general_remarks ? `
        <h3 style="color: #1f5582;">Technician Remarks</h3>
        <p style="padding: 10px; background: #f9f9f9; margin-bottom: 15px;">
            ${this.escape(report.general_remarks)}
        </p>
        ` : ''}
        
        ${report.recommendations ? `
        <h3 style="color: #1f5582;">Recommendations</h3>
        <p style="padding: 10px; background: #fff3cd; margin-bottom: 15px;">
            ${this.escape(report.recommendations)}
        </p>
        ` : ''}
        
        ${report.next_service_date ? `
        <p style="font-weight: bold; color: #1f5582; font-size: 8pt;">
            Next Service Scheduled: ${new Date(report.next_service_date).toLocaleDateString('en-ZA')}
        </p>
        ` : ''}
    </div>
    ` : ''}

    <!-- Client Signature Section -->
    <div class="signature-section" style="margin-top: 25px;">
        <div style="display: inline-block; width: 45%; vertical-align: top;">
            <p style="margin-bottom: 5px; font-weight: bold; font-size: 8pt;">Client Signature:</p>
            ${report.client_signature_data ? `
                <div style="border: 1px solid #ddd; padding: 5px; height: 50px; display: flex; align-items: center; justify-content: center;">
                    <img src="${report.client_signature_data}" alt="Client Signature" style="max-width: 100%; max-height: 50px; object-fit: contain;" />
                </div>
            ` : `
                <div class="signature-line" style="width: 200px; margin: 0;"></div>
            `}
            <p style="margin-top: 3px; font-size: 8pt;">${this.escape(report.client_signature_name || 'Name: ___________________________')}</p>
            <p style="margin-top: 2px; font-size: 7pt; color: #666;">Date: ${new Date().toLocaleDateString('en-ZA')}</p>
        </div>
    </div>

    <div class="footer">
        <p><strong>KPS Pest Control</strong> | 3B Hamman Street, Groblersdal, 0470</p>
        <p>Email: info@kpspestcontrol.co.za</p>
        <p>Generated on ${new Date().toLocaleString('en-ZA')}</p>
    </div>
</body>
</html>
`;
  }

  private async generateFumigationHTML(data: ReportData): Promise<string> {
    const { report, fumigationTreatments, fumigationAreas, fumigationPests, insectMonitors } = data;
    const logoBase64 = await this.getLogoBase64();
    
    logger.info('Fumigation data destructured', {
      areasCount: fumigationAreas?.length,
      pestsCount: fumigationPests?.length,
      treatmentsCount: fumigationTreatments?.length,
      monitorsCount: insectMonitors?.length,
      firstArea: fumigationAreas?.[0]
    });
    
    const clientAddress = [
      report.address_line1,
      report.address_line2,
      report.city,
      report.state,
      report.postal_code
    ].filter(Boolean).join(', ');

    // Group treatments by areas and pests (using new structure)
    const treatmentsByArea = new Map();
    
    // Build treatments from separate areas, pests, and chemicals tables
    fumigationAreas.forEach(area => {
      const areaName = area.is_other ? area.other_description : area.area_name;
      if (!treatmentsByArea.has(areaName)) {
        treatmentsByArea.set(areaName, {
          area: areaName,
          pests: new Set(),
          chemicals: []
        });
      }
    });
    
    // Add all pests to each area (pests are not area-specific in new structure)
    fumigationPests.forEach(pest => {
      const pestName = pest.is_other ? pest.other_description : pest.pest_name;
      treatmentsByArea.forEach(areaData => {
        areaData.pests.add(pestName);
      });
    });
    
    // Add all chemicals to each area (chemicals are not area-specific in new structure)
    fumigationTreatments.forEach(treatment => {
      if (treatment.chemical_name) {
        treatmentsByArea.forEach(areaData => {
          areaData.chemicals.push({
            name: treatment.chemical_name,
            l_number: treatment.l_number || 'N/A',
            batch_number: treatment.batch_number || 'N/A',
            quantity: treatment.quantity,
            unit: treatment.quantity_unit || 'L',
            method: null // application_method not stored in new structure
          });
        });
      }
    });
    
    // Calculate chemical usage
    const chemicalUsageMap = new Map();
    fumigationTreatments.forEach(treatment => {
      if (treatment.chemical_name && treatment.quantity_used) {
        const key = treatment.chemical_name;
        if (!chemicalUsageMap.has(key)) {
          chemicalUsageMap.set(key, {
            name: treatment.chemical_name,
            l_number: treatment.l_number || 'N/A',
            batch_number: treatment.batch_number || 'N/A',
            quantity: 0,
            unit: treatment.quantity_unit || 'L',
            usageCount: 0
          });
        }
        const usage = chemicalUsageMap.get(key);
        usage.quantity += parseFloat(treatment.quantity_used.toString());
        usage.usageCount += 1;
      }
    });
    const chemicalUsageArray = Array.from(chemicalUsageMap.values());
    
    // Calculate insect monitor statistics
    const monitorStats = {
      total: insectMonitors?.length || 0,
      byType: {
        box: insectMonitors?.filter(m => m.monitor_type?.toLowerCase() === 'box').length || 0,
        light: insectMonitors?.filter(m => m.monitor_type?.toLowerCase() === 'light').length || 0,
        tube: 0 // No tube type in current schema
      },
      serviced: insectMonitors?.filter(m => m.monitor_serviced).length || 0,
      glueBoardsReplaced: insectMonitors?.filter(m => m.glue_board_replaced).length || 0,
      tubesReplaced: insectMonitors?.filter(m => m.tubes_replaced).length || 0,
      goodCondition: insectMonitors?.filter(m => m.monitor_condition?.toLowerCase() === 'good').length || 0,
      replaced: insectMonitors?.filter(m => m.monitor_condition?.toLowerCase() === 'replaced').length || 0,
      repaired: insectMonitors?.filter(m => m.monitor_condition?.toLowerCase() === 'repaired').length || 0,
      lightsFaulty: insectMonitors?.filter(m => m.light_condition?.toLowerCase() === 'faulty').length || 0
    };

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Fumigation Report #${report.id}</title>
    <style>
        body { font-family: 'Calibri', Arial, sans-serif; font-size: 9pt; line-height: 1.3; margin: 0; padding: 20px; color: #000; }
        .header-section { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; padding: 10px 0; border-bottom: 2px solid #1f5582; margin-bottom: 15px; }
        .logo-section h1 { margin: 0; font-size: 16pt; color: #1f5582; font-weight: bold; }
        .logo-section h2 { margin: 3px 0 0 0; font-size: 11pt; color: #666; font-weight: normal; }
        .address-section { text-align: right; font-size: 8pt; color: #666; }
        .address-section p { margin: 1px 0; }
        .report-info { background: #f5f5f5; padding: 8px; margin-bottom: 12px; }
        .info-row { margin: 3px 0; font-size: 8pt; }
        .label { font-weight: bold; display: inline-block; width: 130px; }
        .value { display: inline-block; }
        .section { margin: 12px 0; page-break-inside: avoid; }
        .section-title { background: #1f5582; color: white; padding: 6px 10px; margin: 10px 0 8px 0; font-size: 10pt; font-weight: bold; }
        .treatment-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0; }
        .treatment-card { background: #f9f9f9; padding: 10px; border: 1px solid #ddd; page-break-inside: avoid; }
        .treatment-header { font-size: 9pt; font-weight: bold; color: #1f5582; margin-bottom: 5px; }
        .side-by-side { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 10px 0; }
        .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; background: #f9f9f9; padding: 10px; border: 1px solid #ddd; }
        .stat-item { padding: 4px; text-align: center; }
        .stat-label { font-size: 6.5pt; color: #666; }
        .stat-value { font-size: 11pt; font-weight: bold; color: #1f5582; }
        table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 8pt; }
        th { background: #1f5582; color: white; padding: 5px 6px; text-align: left; font-weight: bold; font-size: 8pt; }
        td { padding: 4px 6px; border: 1px solid #ddd; }
        tr:nth-child(even) { background: #f9f9f9; }
        .status-badge { padding: 2px 6px; border-radius: 2px; font-size: 7pt; font-weight: bold; color: white; }
        .status-approved { background: #28a745; }
        .status-pending { background: #ffc107; color: #333; }
        .status-draft { background: #6c757d; }
        .status-declined { background: #dc3545; }
        .footer { margin-top: 20px; padding-top: 12px; border-top: 1px solid #999; font-size: 7pt; text-align: center; color: #666; }
        .signature-section { margin: 15px 0; page-break-inside: avoid; }
        .signature-box { text-align: center; }
        .signature-line { border-top: 1px solid #333; margin: 5px auto; width: 250px; }
        h3 { font-size: 10pt; margin: 8px 0 5px 0; color: #1f5582; }
        h4 { font-size: 9pt; margin: 5px 0; }
        p { margin: 3px 0; font-size: 8pt; }
        ul { margin: 3px 0; padding-left: 18px; }
        li { margin: 2px 0; font-size: 8pt; }
    </style>
</head>
<body>
    <!-- Header with Logo and Address -->
    <div class="header-section">
        <div class="logo-section">
            ${logoBase64 ? `<img src="${logoBase64}" alt="KPS Logo" style="height: 60px; width: auto; margin-bottom: 8px;" />` : ''}
            <h2>FUMIGATION REPORT</h2>
        </div>
        <div class="address-section">
            <p><strong>KPS Pest Control</strong></p>
            <p>3B Hamman Street</p>
            <p>Groblersdal, 0470</p>
            <p>South Africa</p>
        </div>
    </div>

    <!-- Report Details -->
    <div class="report-info">
        <div class="info-row">
            <span class="label">Report ID:</span>
            <span class="value">#${this.escape(report.id)}</span>
        </div>
        <div class="info-row">
            <span class="label">Report Status:</span>
            <span class="value">
                <span class="status-badge status-${this.escape(report.status)}">
                    ${this.escape(report.status).toUpperCase()}
                </span>
            </span>
        </div>
        <div class="info-row">
            <span class="label">Service Date:</span>
            <span class="value">${new Date(report.service_date).toLocaleDateString('en-ZA')}</span>
        </div>
        <div class="info-row">
            <span class="label">Next Service Date:</span>
            <span class="value">${report.next_service_date ? new Date(report.next_service_date).toLocaleDateString('en-ZA') : 'Not scheduled'}</span>
        </div>
        <div class="info-row">
            <span class="label">Generated:</span>
            <span class="value">${new Date().toLocaleString('en-ZA')}</span>
        </div>
    </div>

    <!-- PCO Signature at Top -->
    <div class="signature-section" style="margin-bottom: 20px;">
        <div style="display: inline-block; width: 45%; vertical-align: top;">
            <p style="margin-bottom: 5px; font-weight: bold; font-size: 8pt;">PCO Signature:</p>
            ${report.pco_signature_data ? `
                <div style="border: 1px solid #ddd; padding: 5px; height: 50px; display: flex; align-items: center; justify-content: center;">
                    <img src="${report.pco_signature_data}" alt="PCO Signature" style="max-width: 100%; max-height: 50px; object-fit: contain;" />
                </div>
                <p style="font-size: 7pt; margin-top: 3px;">${this.escape(report.pco_name)}</p>
                <p style="font-size: 7pt;">Date: ${new Date(report.service_date).toLocaleDateString('en-ZA')}</p>
            ` : '<p style="font-size: 7pt;">No signature</p>'}
        </div>
    </div>

    <!-- PCO and Client Details Side-by-Side -->
    <div class="side-by-side">
        <div>
            <h3>Client Details</h3>
            <p><strong>${this.escape(report.client_name)}</strong></p>
            <p>${this.escape(clientAddress)}</p>
        </div>
        <div>
            <h3>PCO Details</h3>
            <p><strong>${this.escape(report.pco_name)}</strong></p>
            <p>PCO Number: ${this.escape(report.pco_number)}</p>
            <p>${this.escape(report.pco_phone || '')}</p>
        </div>
    </div>

    <!-- Treatment Cards by Area (2 per row) -->
    ${treatmentsByArea.size > 0 ? `
    <div class="section">
        <div class="section-title">FUMIGATION TREATMENTS</div>
        <div class="treatment-grid">
        ${Array.from(treatmentsByArea.values()).map(areaData => `
            <div class="treatment-card">
                <div class="treatment-header">${this.formatAreaName(areaData.area)}</div>
                <p style="margin: 3px 0; font-size: 7pt;">
                    <strong>Target Pests:</strong> ${Array.from(areaData.pests).join(', ') || 'Not specified'}
                </p>
                ${areaData.chemicals.length > 0 ? `
                <p style="margin: 3px 0; font-size: 7pt;"><strong>Chemicals Applied:</strong></p>
                <ul style="margin: 3px 0; padding-left: 15px; font-size: 7pt;">
                    ${areaData.chemicals.map((chem: any) => `
                    <li>
                        ${this.escape(chem.name)}${chem.l_number !== 'N/A' ? ` (L${chem.l_number})` : ''}
                        - ${chem.quantity} ${chem.unit}
                    </li>
                    `).join('')}
                </ul>
                ` : ''}
            </div>
        `).join('')}
        </div>
    </div>
    ` : ''}

    <!-- Chemical Usage Summary -->
    ${chemicalUsageArray.length > 0 ? `
    <div class="section">
        <h3 style="color: #8b2635;">Chemical Usage Summary</h3>
        <table>
            <thead>
                <tr>
                    <th>Chemical Name</th>
                    <th style="text-align: center;">Batch Number</th>
                    <th style="text-align: center;">Total Quantity</th>
                    <th style="text-align: center;">Applications</th>
                </tr>
            </thead>
            <tbody>
                ${chemicalUsageArray.map(chem => `
                <tr>
                    <td>${this.escape(chem.name)}${chem.l_number !== 'N/A' ? ` (L${chem.l_number})` : ''}</td>
                    <td style="text-align: center;">${this.escape(chem.batch_number)}</td>
                    <td style="text-align: center;">${chem.quantity.toFixed(2)} ${chem.unit}</td>
                    <td style="text-align: center;">${chem.usageCount}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}

    <!-- Insect Monitors - Light Type -->
    ${insectMonitors && insectMonitors.filter(m => m.monitor_type === 'light').length > 0 ? `
    <div class="section">
        <div class="section-title">LIGHT MONITORS</div>
        <table style="font-size: 9px;">
            <thead>
                <tr>
                    <th>Monitor #</th>
                    <th>Location</th>
                    <th>Monitor<br/>Condition</th>
                    <th>Warning<br/>Sign</th>
                    <th>Light<br/>Condition</th>
                    <th>Glue Board<br/>Replaced</th>
                    <th>Tubes<br/>Replaced</th>
                    <th>Serviced</th>
                </tr>
            </thead>
            <tbody>
                ${insectMonitors
                  .filter(m => m.monitor_type === 'light')
                  .sort((a, b) => {
                    const numA = a.monitor_number || '';
                    const numB = b.monitor_number || '';
                    return numA.localeCompare(numB, undefined, { numeric: true });
                  })
                  .map(monitor => {
                  const monitorCond = monitor.monitor_condition === 'other' && monitor.monitor_condition_other 
                    ? monitor.monitor_condition_other 
                    : monitor.monitor_condition || '-';
                  const lightCond = monitor.light_condition === 'faulty' && monitor.light_faulty_type
                    ? `Faulty (${monitor.light_faulty_type}${monitor.light_faulty_type === 'other' && monitor.light_faulty_other ? ': ' + monitor.light_faulty_other : ''})`
                    : (monitor.light_condition || '-');
                  
                  return `
                <tr>
                    <td><strong>${this.escape(monitor.monitor_number || '-')}</strong></td>
                    <td>${this.escape(monitor.location || '-')}</td>
                    <td style="text-align: center;">${this.escape(monitorCond)}</td>
                    <td style="text-align: center;">${this.escape(monitor.warning_sign_condition || '-')}</td>
                    <td style="text-align: center;">${this.escape(lightCond)}</td>
                    <td style="text-align: center;">${monitor.glue_board_replaced ? '✓' : '-'}</td>
                    <td style="text-align: center;">${monitor.tubes_replaced ? '✓' : '-'}</td>
                    <td style="text-align: center;">${monitor.monitor_serviced ? '✓' : '-'}</td>
                </tr>
                `;
                }).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}

    <!-- Insect Monitors - Box Type -->
    ${insectMonitors && insectMonitors.filter(m => m.monitor_type === 'box').length > 0 ? `
    <div class="section">
        <div class="section-title">BOX MONITORS</div>
        <table style="font-size: 9px;">
            <thead>
                <tr>
                    <th>Monitor #</th>
                    <th>Location</th>
                    <th>Monitor<br/>Condition</th>
                    <th>Warning<br/>Sign</th>
                    <th>Glue Board<br/>Replaced</th>
                    <th>Serviced</th>
                </tr>
            </thead>
            <tbody>
                ${insectMonitors
                  .filter(m => m.monitor_type === 'box')
                  .sort((a, b) => {
                    const numA = a.monitor_number || '';
                    const numB = b.monitor_number || '';
                    return numA.localeCompare(numB, undefined, { numeric: true });
                  })
                  .map(monitor => {
                  const monitorCond = monitor.monitor_condition === 'other' && monitor.monitor_condition_other 
                    ? monitor.monitor_condition_other 
                    : monitor.monitor_condition || '-';
                  
                  return `
                <tr>
                    <td><strong>${this.escape(monitor.monitor_number || '-')}</strong></td>
                    <td>${this.escape(monitor.location || '-')}</td>
                    <td style="text-align: center;">${this.escape(monitorCond)}</td>
                    <td style="text-align: center;">${this.escape(monitor.warning_sign_condition || '-')}</td>
                    <td style="text-align: center;">${monitor.glue_board_replaced ? '✓' : '-'}</td>
                    <td style="text-align: center;">${monitor.monitor_serviced ? '✓' : '-'}</td>
                </tr>
                `;
                }).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}

    <!-- Monitor Summary Statistics - Split by Type -->
    ${insectMonitors && insectMonitors.length > 0 ? `
    <div class="section">
        <h3 style="color: #8b2635;">Monitor Summary</h3>
        
        <!-- Light Monitors Summary -->
        ${monitorStats.byType.light > 0 ? `
        <h4 style="color: #555; margin: 10px 0 5px 0;">Light Monitors (${monitorStats.byType.light})</h4>
        <div class="stat-grid">
            <div class="stat-item">
                <div class="stat-label">Total Light Monitors</div>
                <div class="stat-value">${monitorStats.byType.light}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Serviced</div>
                <div class="stat-value">${insectMonitors.filter(m => m.monitor_type === 'light' && m.monitor_serviced).length}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Good Condition</div>
                <div class="stat-value">${insectMonitors.filter(m => m.monitor_type === 'light' && m.monitor_condition === 'good').length}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Replaced</div>
                <div class="stat-value">${insectMonitors.filter(m => m.monitor_type === 'light' && m.monitor_condition === 'replaced').length}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Repaired</div>
                <div class="stat-value">${insectMonitors.filter(m => m.monitor_type === 'light' && m.monitor_condition === 'repaired').length}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Glue Boards Replaced</div>
                <div class="stat-value">${insectMonitors.filter(m => m.monitor_type === 'light' && m.glue_board_replaced).length}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Tubes Replaced</div>
                <div class="stat-value">${insectMonitors.filter(m => m.monitor_type === 'light' && m.tubes_replaced).length}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Faulty Lights</div>
                <div class="stat-value">${insectMonitors.filter(m => m.monitor_type === 'light' && m.light_condition === 'faulty').length}</div>
            </div>
        </div>
        ` : ''}
        
        <!-- Box Monitors Summary -->
        ${monitorStats.byType.box > 0 ? `
        <h4 style="color: #555; margin: 15px 0 5px 0;">Box Monitors (${monitorStats.byType.box})</h4>
        <div class="stat-grid">
            <div class="stat-item">
                <div class="stat-label">Total Box Monitors</div>
                <div class="stat-value">${monitorStats.byType.box}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Serviced</div>
                <div class="stat-value">${insectMonitors.filter(m => m.monitor_type === 'box' && m.monitor_serviced).length}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Good Condition</div>
                <div class="stat-value">${insectMonitors.filter(m => m.monitor_type === 'box' && m.monitor_condition === 'good').length}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Replaced</div>
                <div class="stat-value">${insectMonitors.filter(m => m.monitor_type === 'box' && m.monitor_condition === 'replaced').length}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Repaired</div>
                <div class="stat-value">${insectMonitors.filter(m => m.monitor_type === 'box' && m.monitor_condition === 'repaired').length}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Glue Boards Replaced</div>
                <div class="stat-value">${insectMonitors.filter(m => m.monitor_type === 'box' && m.glue_board_replaced).length}</div>
            </div>
        </div>
        ` : ''}
    </div>
    ` : ''}

    <!-- Remarks and Recommendations -->
    ${report.general_remarks || report.recommendations ? `
    <div class="section">
        ${report.general_remarks ? `
        <h3 style="color: #1f5582;">Technician Remarks</h3>
        <p style="padding: 10px; background: #f9f9f9; margin-bottom: 15px;">
            ${this.escape(report.general_remarks)}
        </p>
        ` : ''}
        
        ${report.recommendations ? `
        <h3 style="color: #1f5582;">Recommendations</h3>
        <p style="padding: 10px; background: #fff3cd; margin-bottom: 15px;">
            ${this.escape(report.recommendations)}
        </p>
        ` : ''}
        
        ${report.next_service_date ? `
        <p style="font-weight: bold; color: #1f5582; font-size: 8pt;">
            Next Service Scheduled: ${new Date(report.next_service_date).toLocaleDateString('en-ZA')}
        </p>
        ` : ''}
    </div>
    ` : ''}

    <!-- Client Signature Section -->
    <div class="signature-section" style="margin-top: 25px;">
        <div style="display: inline-block; width: 45%; vertical-align: top;">
            <p style="margin-bottom: 5px; font-weight: bold; font-size: 8pt;">Client Signature:</p>
            ${report.client_signature_data ? `
                <div style="border: 1px solid #ddd; padding: 5px; height: 50px; display: flex; align-items: center; justify-content: center;">
                    <img src="${report.client_signature_data}" alt="Client Signature" style="max-width: 100%; max-height: 50px; object-fit: contain;" />
                </div>
            ` : `
                <div class="signature-line" style="width: 200px; margin: 0;"></div>
            `}
            <p style="margin-top: 3px; font-size: 8pt;">${this.escape(report.client_signature_name || 'Name: ___________________________')}</p>
            <p style="margin-top: 2px; font-size: 7pt; color: #666;">Date: ${new Date().toLocaleDateString('en-ZA')}</p>
        </div>
    </div>

    <!-- Footer -->
    <div class="footer">
        <p><strong>KPS Pest Control</strong> | 3B Hamman Street, Groblersdal, 0470</p>
        <p>Tel: +27 11 123 4567 | Email: info@kpspestcontrol.co.za</p>
        <p>Generated on ${new Date().toLocaleString('en-ZA')}</p>
    </div>
</body>
</html>
`;
  }

  // Combined report for report_type = 'both'
  private async generateCombinedReportHTML(data: ReportData): Promise<string> {
    const baitHTML = await this.generateBaitInspectionHTML(data);
    const fumigationHTML = await this.generateFumigationHTML(data);
    
    // Extract body content from each (remove DOCTYPE, html, head, body tags)
    const baitBody = baitHTML.match(/<body>([\s\S]*)<\/body>/)?.[1] || '';
    const fumigationBody = fumigationHTML.match(/<body>([\s\S]*)<\/body>/)?.[1] || '';
    
    // Get style from bait inspection (they should be the same now)
    const style = baitHTML.match(/<style>([\s\S]*)<\/style>/)?.[1] || '';
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Complete Report #${data.report.id}</title>
    <style>${style}</style>
</head>
<body>
    ${baitBody}
    <div style="page-break-before: always;"></div>
    ${fumigationBody}
</body>
</html>
`;
  }
}

export const pdfService = new PDFService();
