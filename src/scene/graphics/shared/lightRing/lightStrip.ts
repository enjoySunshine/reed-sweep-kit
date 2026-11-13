import { angularDistanceToSweep } from './arcSweep';

import type { ArcSweep } from './arcSweep';

/**
 * Geometry shared by every circular light ring.
 * @property {number} centerX - X coordinate of the circle centre.
 * @property {number} centerY - Y coordinate of the circle centre.
 * @property {number} radius - Distance from the centre to the centreline of the strip.
 * @property {number} strokeWidth - Width of the painted strip, in the same units.
 * @category scene
 * @standard
 */
export interface LightRingGeometry
{
    /** X coordinate of the circle centre. */
    centerX: number;
    /** Y coordinate of the circle centre. */
    centerY: number;
    /** Distance from the centre to the centreline of the strip. */
    radius: number;
    /** Width of the painted strip, in the same units. */
    strokeWidth: number;
}

/**
 * Tolerances used when deciding whether a point is painted by the strip.
 * @property {number} radial - Maximum allowed distance from the strip centreline.
 * @property {number} angular - Maximum allowed angular gap from the swept arc, in radians.
 * @category scene
 * @standard
 */
export interface PointOnArcTolerance
{
    /** Maximum allowed distance from the strip centreline. */
    radial: number;
    /** Maximum allowed angular gap from the swept arc, in radians. */
    angular: number;
}

/**
 * A single sampled point on the strip centreline.
 * @property {number} x - X coordinate.
 * @property {number} y - Y coordinate.
 * @property {number} angle - Angle from the ring centre, in radians.
 * @category scene
 * @standard
 */
export interface LightStripPoint
{
    /** X coordinate. */
    x: number;
    /** Y coordinate. */
    y: number;
    /** Angle from the ring centre, in radians. */
    angle: number;
}

/** Half of the stroke width is the maximum distance from the strip centreline. */
const DEFAULT_RADIAL_TOLERANCE_FACTOR = 0.5;

/** Angular slack, in radians, used to absorb rounding of sampled coordinates. */
const DEFAULT_ANGULAR_TOLERANCE = 0.01;

/**
 * Builds the default point-membership tolerances for a ring.
 * @param {LightRingGeometry} geometry - The ring geometry.
 * @returns {PointOnArcTolerance} Radial and angular tolerances.
 * @category scene
 * @standard
 */
export function defaultPointTolerance(geometry: LightRingGeometry): PointOnArcTolerance
{
    return {
        radial: geometry.strokeWidth * DEFAULT_RADIAL_TOLERANCE_FACTOR,
        angular: DEFAULT_ANGULAR_TOLERANCE,
    };
}

/**
 * Tests whether a point is painted by the light strip.
 *
 * The angular part of the test reuses the sweep resolved for the marker path,
 * so the path data and the point-on-light answer can never disagree.
 * @param {number} x - X coordinate of the point to test.
 * @param {number} y - Y coordinate of the point to test.
 * @param {LightRingGeometry} geometry - The ring geometry.
 * @param {ArcSweep} resolved - The sweep resolved with {@link resolveArcSweep}.
 * @param {PointOnArcTolerance} [tolerance] - Radial and angular slack.
 *  Defaults to half the stroke width and a small angular epsilon.
 * @returns {boolean} `true` when the point falls on the strip.
 * @category scene
 * @standard
 */
export function isPointOnLight(
    x: number,
    y: number,
    geometry: LightRingGeometry,
    resolved: ArcSweep,
    tolerance: PointOnArcTolerance = defaultPointTolerance(geometry)
): boolean
{
    const dx = x - geometry.centerX;
    const dy = y - geometry.centerY;
    const distanceFromCenter = Math.hypot(dx, dy);

    if (Math.abs(distanceFromCenter - geometry.radius) > tolerance.radial)
    {
        return false;
    }

    const angle = Math.atan2(dy, dx);

    return angularDistanceToSweep(angle, resolved) <= tolerance.angular;
}

/**
 * Samples points along the centreline of the strip.
 *
 * Angles are interpolated from the same resolved sweep used by the marker
 * path, including its sign, so reverse-direction and wrapped full-turn rings
 * produce points in the traversed order.
 * @param {LightRingGeometry} geometry - The ring geometry.
 * @param {ArcSweep} resolved - The sweep resolved with {@link resolveArcSweep}.
 * @param {number} segments - Number of segments between the start and end points.
 * @returns {LightStripPoint[]} One point per sampled angle, including both ends.
 * @category scene
 * @standard
 */
export function sampleLightStrip(
    geometry: LightRingGeometry,
    resolved: ArcSweep,
    segments: number
): LightStripPoint[]
{
    const count = Math.max(1, Math.floor(segments));
    const points: LightStripPoint[] = [];

    for (let i = 0; i <= count; i++)
    {
        const angle = resolved.startAngle + (resolved.sweep * (i / count));

        points.push({
            x: geometry.centerX + (geometry.radius * Math.cos(angle)),
            y: geometry.centerY + (geometry.radius * Math.sin(angle)),
            angle,
        });
    }

    return points;
}
