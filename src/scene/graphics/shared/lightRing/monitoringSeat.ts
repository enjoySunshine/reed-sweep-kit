import { resolveArcSweep } from './arcSweep';
import { isPointOnLight, sampleLightStrip } from './lightStrip';
import { buildLightRingMarker } from './markerPath';

import type { ArcSweep } from './arcSweep';
import type { LightRingGeometry, LightStripPoint, PointOnArcTolerance } from './lightStrip';
import type { LightRingFrameOverride, LightRingMarker } from './markerPath';

/**
 * One resolved half ring of the monitoring-seat light ring.
 * @property {LightRingMarker} marker - SVG path data, viewport and outer frame.
 * @property {ArcSweep} resolved - The single sweep shared by path and strip.
 * @property {Function} isPointOnLight - Tests whether a point is painted by this ring.
 * @property {Function} sampleStrip - Samples centreline points in traversal order.
 * @category scene
 * @standard
 */
export interface MonitoringSeatHalfRing
{
    /** SVG path data, viewport and outer frame. */
    marker: LightRingMarker;
    /** The single sweep shared by path and strip. */
    resolved: ArcSweep;
    /** Tests whether a point is painted by this ring. */
    isPointOnLight: (x: number, y: number, tolerance?: PointOnArcTolerance) => boolean;
    /** Samples centreline points in traversal order. */
    sampleStrip: (segments: number) => LightStripPoint[];
}

/**
 * Monitoring-seat ring: centred on the origin, radius 16, stroke width 2.
 * @category scene
 * @standard
 */
export const MONITORING_SEAT_GEOMETRY: LightRingGeometry = {
    centerX: 0,
    centerY: 0,
    radius: 16,
    strokeWidth: 2,
};

/**
 * The angle the half ring starts at.
 * @category scene
 * @standard
 */
export const MONITORING_SEAT_START_ANGLE = 0;

/**
 * The angle the half ring ends at, exactly π.
 * @category scene
 * @standard
 */
export const MONITORING_SEAT_END_ANGLE = Math.PI;

/**
 * Stroke colour of the ring, white.
 * @category scene
 * @standard
 */
export const MONITORING_SEAT_STROKE = '#ffffff';

/**
 * The ring is an outline only, so the interior is never filled.
 * @category scene
 * @standard
 */
export const MONITORING_SEAT_FILL = 'none';

/**
 * Frozen viewport and frame of the first ring (angles grow, upper half).
 *
 * These metrics predate the geometric frame builder and are kept byte-for-byte
 * stable; the path data and point membership still come from the shared sweep.
 */
const UPPER_HALF_FRAME: LightRingFrameOverride = {
    viewBox: { x: -17.01, y: -1.01, width: 34.01, height: 17.92 },
    frame: { left: -17.01, top: -1.01, right: 17.01, bottom: 16.92 },
};

/**
 * Frozen viewport and frame of the second ring (angles shrink, lower half).
 *
 * Mirror of {@link UPPER_HALF_FRAME} across the x-axis.
 */
const LOWER_HALF_FRAME: LightRingFrameOverride = {
    viewBox: { x: -17.01, y: -16.92, width: 34.01, height: 17.92 },
    frame: { left: -17.01, top: -16.92, right: 17.01, bottom: 1.01 },
};

/**
 * Builds one half ring of the monitoring-seat light ring.
 *
 * Both directions share one geometry and one pair of endpoint angles; only the
 * traversal direction differs, and `resolveArcSweep` is the single place that
 * turns that direction into the signed sweep feeding the path and the strip.
 * The documented viewport and outer frame are supplied as frozen overrides so
 * they remain exactly as specified.
 * @param {boolean} increasing - `true` for the ring over growing angles
 *  (upper half), `false` for the ring over shrinking angles (lower half).
 * @returns {MonitoringSeatHalfRing} The marker, resolved sweep and strip
 *  helpers for the half ring.
 * @category scene
 * @standard
 */
export function buildMonitoringSeatHalfRing(increasing: boolean): MonitoringSeatHalfRing
{
    const geometry = MONITORING_SEAT_GEOMETRY;
    const { marker, resolved } = buildLightRingMarker(
        geometry,
        MONITORING_SEAT_START_ANGLE,
        MONITORING_SEAT_END_ANGLE,
        increasing,
        {
            stroke: MONITORING_SEAT_STROKE,
            fill: MONITORING_SEAT_FILL,
            frameOverride: increasing ? UPPER_HALF_FRAME : LOWER_HALF_FRAME,
        }
    );

    return {
        marker,
        resolved,
        isPointOnLight: (x: number, y: number, tolerance?: PointOnArcTolerance): boolean =>
            isPointOnLight(x, y, geometry, resolved, tolerance),
        sampleStrip: (segments: number): LightStripPoint[] =>
            sampleLightStrip(geometry, resolved, segments),
    };
}

/**
 * Re-runs the shared sweep resolution for the monitoring-seat angles.
 *
 * Exposed so callers that only need the angular result (for example custom
 * sampling) stay on the same code path as the marker builder.
 * @param {boolean} increasing - Travel direction: `true` grows angles,
 *  `false` shrinks them.
 * @returns {ArcSweep} The resolved sweep.
 * @category scene
 * @standard
 */
export function resolveMonitoringSeatSweep(increasing: boolean): ArcSweep
{
    return resolveArcSweep(
        MONITORING_SEAT_START_ANGLE,
        MONITORING_SEAT_END_ANGLE,
        increasing
    );
}
