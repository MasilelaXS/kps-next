/**
 * Helper functions for tracking newly added equipment (stations and monitors)
 * Used for invoicing and reporting purposes
 * 
 * Logic: 
 * - Client has expected equipment counts (e.g., 5 inside stations, 3 outside stations)
 * - PCO adds 8 inside stations in report
 * - System marks last 3 stations (8-5=3) as new additions
 * - Updates client expected count from 5 to 8
 * - Next visit, expected will be 8
 */

import { executeQuery } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

/**
 * Mark newly added bait stations based on exceeding expected count
 * Call this AFTER all stations have been added to the report
 * @param reportId - Report ID
 * @param clientId - Client ID
 * @param location - Station location (inside/outside)
 */
export async function markNewBaitStations(
  reportId: number,
  clientId: number,
  location: 'inside' | 'outside'
): Promise<{ newCount: number; totalCount: number }> {
  try {
    // Get client's expected count
    const field = location === 'inside' ? 'total_bait_stations_inside' : 'total_bait_stations_outside';
    const clientData = await executeQuery<RowDataPacket[]>(
      `SELECT ${field} as expected_count FROM clients WHERE id = ?`,
      [clientId]
    );

    const expectedCount = clientData.length > 0 ? (clientData[0] as any).expected_count : 0;

    // Count actual stations in this report for this location
    const stationCount = await executeQuery<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM bait_stations 
       WHERE report_id = ? AND location = ?`,
      [reportId, location]
    );

    const totalCount = (stationCount[0] as any).count;
    const newCount = Math.max(0, totalCount - expectedCount);

    if (newCount > 0) {
      // Mark the last N stations as new (ordered by ID to get recently added ones)
      await executeQuery(
        `UPDATE bait_stations 
         SET is_new_addition = 1
         WHERE report_id = ? AND location = ?
         ORDER BY id DESC
         LIMIT ?`,
        [reportId, location, newCount]
      );
    }

    return { newCount, totalCount };
  } catch (error) {
    console.error('Error marking new bait stations:', error);
    return { newCount: 0, totalCount: 0 };
  }
}

/**
 * Mark newly added insect monitors based on exceeding expected count
 * Call this AFTER all monitors have been added to the report
 * @param reportId - Report ID
 * @param clientId - Client ID
 * @param monitorType - Monitor type (box/fly_trap)
 */
export async function markNewInsectMonitors(
  reportId: number,
  clientId: number,
  monitorType: 'box' | 'fly_trap'
): Promise<{ newCount: number; totalCount: number }> {
  try {
    // Get client's expected count
    const field = monitorType === 'fly_trap' ? 'total_insect_monitors_light' : 'total_insect_monitors_box';
    const clientData = await executeQuery<RowDataPacket[]>(
      `SELECT ${field} as expected_count FROM clients WHERE id = ?`,
      [clientId]
    );

    const expectedCount = clientData.length > 0 ? (clientData[0] as any).expected_count : 0;

    // Count actual monitors in this report for this type
    const monitorCount = await executeQuery<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM insect_monitors 
       WHERE report_id = ? AND monitor_type = ?`,
      [reportId, monitorType]
    );

    const totalCount = (monitorCount[0] as any).count;
    const newCount = Math.max(0, totalCount - expectedCount);

    if (newCount > 0) {
      // Mark the last N monitors as new (ordered by ID to get recently added ones)
      await executeQuery(
        `UPDATE insect_monitors 
         SET is_new_addition = 1
         WHERE report_id = ? AND monitor_type = ?
         ORDER BY id DESC
         LIMIT ?`,
        [reportId, monitorType, newCount]
      );
    }

    return { newCount, totalCount };
  } catch (error) {
    console.error('Error marking new insect monitors:', error);
    return { newCount: 0, totalCount: 0 };
  }
}

/**
 * Update client's expected equipment counts based on actual counts in report
 * Call this when report is submitted
 * @param reportId - Report ID
 * @param clientId - Client ID
 */
export async function updateClientExpectedCounts(
  reportId: number,
  clientId: number
): Promise<void> {
  try {
    // Count bait stations by location
    const insideCount = await executeQuery<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM bait_stations 
       WHERE report_id = ? AND location = 'inside'`,
      [reportId]
    );

    const outsideCount = await executeQuery<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM bait_stations 
       WHERE report_id = ? AND location = 'outside'`,
      [reportId]
    );

    // Count insect monitors by type
    const flyTrapCount = await executeQuery<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM insect_monitors 
       WHERE report_id = ? AND monitor_type = 'fly_trap'`,
      [reportId]
    );

    const boxCount = await executeQuery<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM insect_monitors 
       WHERE report_id = ? AND monitor_type = 'box'`,
      [reportId]
    );

    // Update client expected counts
    await executeQuery(
      `UPDATE clients 
       SET total_bait_stations_inside = ?,
           total_bait_stations_outside = ?,
           total_insect_monitors_light = ?,
           total_insect_monitors_box = ?
       WHERE id = ?`,
      [
        (insideCount[0] as any).count,
        (outsideCount[0] as any).count,
        (flyTrapCount[0] as any).count,
        (boxCount[0] as any).count,
        clientId
      ]
    );
  } catch (error) {
    console.error('Error updating client expected counts:', error);
  }
}

/**
 * Count newly added monitors for a report
 * @param reportId - Report ID
 * @returns Count of newly added insect monitors
 */
export async function countNewInsectMonitors(reportId: number): Promise<number> {
  try {
    const result = await executeQuery<RowDataPacket[]>(
      `SELECT COUNT(*) as count 
       FROM insect_monitors 
       WHERE report_id = ? AND is_new_addition = 1`,
      [reportId]
    );

    return (result[0] as any).count || 0;
  } catch (error) {
    console.error('Error counting new insect monitors:', error);
    return 0;
  }
}

/**
 * Count newly added bait stations for a report
 * @param reportId - Report ID
 * @returns Count of newly added bait stations
 */
export async function countNewBaitStations(reportId: number): Promise<number> {
  try {
    const result = await executeQuery<RowDataPacket[]>(
      `SELECT COUNT(*) as count 
       FROM bait_stations 
       WHERE report_id = ? AND is_new_addition = 1`,
      [reportId]
    );

    return (result[0] as any).count || 0;
  } catch (error) {
    console.error('Error counting new bait stations:', error);
    return 0;
  }
}

/**
 * Update report summary counts for new equipment
 * @param reportId - Report ID
 */
export async function updateReportNewEquipmentCounts(reportId: number): Promise<void> {
  try {
    const newStationsCount = await countNewBaitStations(reportId);
    const newMonitorsCount = await countNewInsectMonitors(reportId);

    await executeQuery(
      `UPDATE reports 
       SET new_bait_stations_count = ?, 
           new_insect_monitors_count = ?
       WHERE id = ?`,
      [newStationsCount, newMonitorsCount, reportId]
    );
  } catch (error) {
    console.error('Error updating report new equipment counts:', error);
  }
}
