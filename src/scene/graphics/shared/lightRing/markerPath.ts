import { normalizeAngle, resolveArcSweep } from './arcSweep';

import type { ArcSweep, ZeroSweepMode } from './arcSweep';
import type { LightRingGeometry } from './lightStrip';

/**
 * The painted marker for one light ring.
 * @property {string} pathData - SVG path `d` attribute describing the arc.
 * @property {string} stroke - Stroke colour as a CSS colour string.
 * @property {number} strokeWidth - Stroke width in marker units.
 * @property {string} fill - Fill colour as a CSS colour string.
 * @property {{x: number, y: number, width: number, height: number}} viewBox -
 *  Marker viewport.
 * @property {{left: number, top: number, right: number, bottom: number}} frame -
 *  Axis-aligned outer frame of the painted stroke.
 * @category scene
 * @standard
 */
export interface LightRingMarker
{
    /** SVG path `d` attribute describing the arc. */
    pathData: string;
    /** Stroke colour as a CSS colour string. */
    stroke: string;
    /** Stroke width in marker units. */
    strokeWidth: number;
    /** Fill colour as a CSS colour string. */
    fill: string;
    /** Marker viewport `[x, y, width, height]`. */
    viewBox: { x: number; y: number; width: number; height: number };
    /** Axis-aligned outer frame of the painted stroke. */
    frame: { left: number; top: number; right: number; bottom: number };
}

/**
 * A precomputed viewport and frame, used when a marker must reproduce fixed
 * legacy metrics instead of the geometrically derived ones.
 * @property {LightRingMarker['viewBox']} viewBox - The frozen viewport.
 * @property {LightRingMarker['frame']} frame - The frozen outer frame.
 * @category scene
 * @standard
 */
export interface LightRingFrameOverride
{
    /** The frozen viewport. */
    viewBox: LightRingMarker['viewBox'];
    /** The frozen outer frame. */
    frame: LightRingMarker['frame'];
}

/** Default precision for the numbers written into the path data and viewport. */
const DEFAULT_PRECISION = 2;

/**
 * Extra padding, as a fraction of the stroke width, added around the painted
 * strip when measuring the geometric marker frame. Half the stroke already
 * covers the outline itself; this keeps rounded caps and antialiased edges
 * inside the reported viewport.
 */
const FRAME_PADDING_FACTOR = 0.005;

/**
 * Formats a number for SVG output, dropping trailing zeros produced by
 * `toFixed` so integers stay integers (for example `16.00` becomes `16`).
 * @param {number} value - The number to format.
 * @param {number} precision - Maximum number of decimal places.
 * @returns {string} The formatted number as a string.
 * @category scene
 * @standard
 */
function formatNumber(value: number, precision: number): string
{
    return parseFloat(value.toFixed(precision)).toString();
}

/**
 * Rounds a number half away from zero at the given decimal precision.
 * @param {number} value - The number to round.
 * @param {number} precision - Number of decimal places to keep.
 * @returns {number} The rounded value.
 * @category scene
 * @standard
 */
function round(value: number, precision: number): number
{
    const factor = 10 ** precision;

    return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Point on the ring centreline at a given angle.
 * @param {LightRingGeometry} geometry - The ring geometry.
 * @param {number} angle - The angle, in radians.
 * @returns {{x: number, y: number}} The `x` and `y` coordinates.
 * @category scene
 * @standard
 */
function pointAtAngle(geometry: LightRingGeometry, angle: number): { x: number; y: number }
{
    return {
        x: geometry.centerX + (geometry.radius * Math.cos(angle)),
        y: geometry.centerY + (geometry.radius * Math.sin(angle)),
    };
}

/**
 * Builds the SVG arc command(s) for a resolved sweep.
 *
 * A full turn cannot be expressed by a single SVG arc (its endpoints would
 * coincide), so it is split into two half turns drawn from the start point.
 * @param {LightRingGeometry} geometry - The ring geometry.
 * @param {ArcSweep} resolved - The shared resolved sweep.
 * @param {number} precision - Decimal precision for the written numbers.
 * @returns {string} The path data, starting with a moveto.
 * @category scene
 * @standard
 */
function buildArcPath(
    geometry: LightRingGeometry,
    resolved: ArcSweep,
    precision: number
): string
{
    const { radius } = geometry;
    const start = pointAtAngle(geometry, resolved.startAngle);
    const radiusText = formatNumber(radius, precision);
    const startText = `M${formatNumber(start.x, precision)} ${formatNumber(start.y, precision)}`;

    if (resolved.sweep === 0)
    {
        return startText;
    }

    const sweepFlag = resolved.sweep > 0 ? 1 : 0;

    const arcTo = (angle: number, largeArc: 0 | 1): string =>
    {
        const point = pointAtAngle(geometry, angle);

        return `A${radiusText} ${radiusText} 0 ${largeArc} ${sweepFlag} `
            + `${formatNumber(point.x, precision)} ${formatNumber(point.y, precision)}`;
    };

    if (resolved.fullTurn)
    {
        const halfway = resolved.startAngle + (resolved.sweep / 2);

        // No separator before the command letter: it already terminates the moveto number.
        return `${startText}${arcTo(halfway, 0)} ${arcTo(resolved.startAngle, 0)}`;
    }

    const largeArc: 0 | 1 = Math.abs(resolved.sweep) > Math.PI ? 1 : 0;

    return `${startText}${arcTo(resolved.endAngle, largeArc)}`;
}

/**
 * Computes the axis-aligned frame of the painted stroke for a resolved sweep.
 *
 * Every extreme point of the swept angle range is inspected, including the
 * cardinal angles it crosses, so partial arcs and full circles share one rule.
 * @param {LightRingGeometry} geometry - The ring geometry.
 * @param {ArcSweep} resolved - The shared resolved sweep.
 * @returns {{left: number, top: number, right: number, bottom: number}} The
 *  outer frame after accounting for half the stroke width and padding.
 * @category scene
 * @standard
 */
export function computeLightRingFrame(
    geometry: LightRingGeometry,
    resolved: ArcSweep
): { left: number; top: number; right: number; bottom: number }
{
    const halfStroke = geometry.strokeWidth / 2;
    const padding = geometry.strokeWidth * FRAME_PADDING_FACTOR;
    const candidates: number[] = [
        normalizeAngle(resolved.startAngle),
        normalizeAngle(resolved.endAngle),
    ];

    if (!resolved.fullTurn)
    {
        // Cardinal angles in [0, 2π).
        const cardinals = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
        const magnitude = Math.abs(resolved.sweep);
        const direction = resolved.sweep > 0 ? 1 : -1;

        for (const cardinal of cardinals)
        {
            const distance = normalizeAngle((cardinal - resolved.startAngle) * direction);

            if (distance > 0 && distance < magnitude)
            {
                candidates.push(cardinal);
            }
        }
    }
    else
    {
        candidates.push(Math.PI / 2, Math.PI, (3 * Math.PI) / 2);
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const angle of candidates)
    {
        const point = pointAtAngle(geometry, angle);

        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
    }

    return {
        left: minX - halfStroke - padding,
        top: minY - halfStroke - padding,
        right: maxX + halfStroke + padding,
        bottom: maxY + halfStroke + padding,
    };
}

/**
 * Builds the complete marker for a light ring.
 *
 * The path data, viewport, outer frame and every downstream point-membership
 * answer are driven by one call to {@link resolveArcSweep}. The viewport and
 * frame are derived geometrically unless a frozen `frameOverride` is supplied
 * to reproduce documented legacy metrics exactly.
 * @param {LightRingGeometry} geometry - The ring geometry.
 * @param {number} startAngle - The starting angle, in radians.
 * @param {number} endAngle - The ending angle, in radians.
 * @param {boolean} increasing - Travel direction: `true` grows angles,
 *  `false` shrinks them.
 * @param {object} [options] - Marker options.
 * @param {string} [options.stroke] - Stroke colour, defaults to white.
 * @param {string} [options.fill] - Fill colour, defaults to `none`.
 * @param {number} [options.precision] - Decimal precision, defaults to 2.
 * @param {ZeroSweepMode} [options.zeroSweepMode] - Rule for coincident angles.
 * @param {LightRingFrameOverride} [options.frameOverride] - Frozen frame metrics.
 * @returns {{marker: LightRingMarker, resolved: ArcSweep}} The assembled marker
 *  and its shared resolved sweep.
 * @category scene
 * @standard
 */
export function buildLightRingMarker(
    geometry: LightRingGeometry,
    startAngle: number,
    endAngle: number,
    increasing: boolean,
    options: {
        stroke?: string;
        fill?: string;
        precision?: number;
        zeroSweepMode?: ZeroSweepMode;
        frameOverride?: LightRingFrameOverride;
    } = {}
): { marker: LightRingMarker; resolved: ArcSweep }
{
    const {
        stroke = '#ffffff',
        fill = 'none',
        precision = DEFAULT_PRECISION,
        zeroSweepMode,
        frameOverride,
    } = options;

    const resolved = resolveArcSweep(startAngle, endAngle, increasing, { zeroSweepMode });

    const metrics = frameOverride ?? (() =>
    {
        const derived = computeLightRingFrame(geometry, resolved);

        return {
            viewBox: {
                x: round(derived.left, precision),
                y: round(derived.top, precision),
                width: round(derived.right - derived.left, precision),
                height: round(derived.bottom - derived.top, precision),
            },
            frame: {
                left: round(derived.left, precision),
                top: round(derived.top, precision),
                right: round(derived.right, precision),
                bottom: round(derived.bottom, precision),
            },
        };
    })();

    const marker: LightRingMarker = {
        pathData: buildArcPath(geometry, resolved, precision),
        stroke,
        strokeWidth: geometry.strokeWidth,
        fill,
        viewBox: metrics.viewBox,
        frame: metrics.frame,
    };

    return { marker, resolved };
}
