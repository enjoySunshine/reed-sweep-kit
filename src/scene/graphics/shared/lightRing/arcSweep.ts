/**
 * Single source of truth for the angle a circular marker sweeps through.
 *
 * Every consumer (the SVG marker path, the light-strip sample points and the
 * point-on-light membership test) derives its geometry from `resolveArcSweep`,
 * so changing how a full turn wraps around, or how the reverse direction picks
 * its angle, only has to be edited here.
 * @category scene
 * @standard
 */

/** A full turn, in radians. */
const FULL_TURN = Math.PI * 2;

/** Sweeps whose magnitude is within this of a full turn are treated as closed circles. */
const FULL_TURN_EPSILON = 1e-6;

/**
 * How a sweep with coincident start and end angles is interpreted.
 *
 * `none` collapses to a single point, while `fullTurn` closes a complete
 * circle — the only way a full turn can be requested when both endpoint
 * angles are written down as the same value.
 * @category scene
 * @standard
 */
export type ZeroSweepMode = 'none' | 'fullTurn';

/**
 * Options controlling sweep resolution.
 * @property {ZeroSweepMode} [zeroSweepMode] - How coincident start and end
 *  angles are treated. Defaults to `none` (a point); pass `fullTurn` to close
 *  a complete circle.
 * @category scene
 * @standard
 */
export interface ResolveArcSweepOptions
{
    zeroSweepMode?: ZeroSweepMode;
}

/**
 * The resolved geometry of an angular sweep.
 * @property {number} startAngle - Angle of the arc start, in radians.
 * @property {number} endAngle - Angle of the arc end after wrapping, in radians.
 * @property {number} sweep - Signed angle travelled from the start. Positive
 *  means angles grow, negative means angles shrink. Its magnitude never
 *  exceeds one full turn.
 * @property {boolean} fullTurn - Whether the sweep closes a complete circle.
 * @category scene
 * @standard
 */
export interface ArcSweep
{
    /** Angle of the arc start, in radians. */
    startAngle: number;
    /** Angle of the arc end after wrapping, in radians. */
    endAngle: number;
    /** Signed angle travelled from the start; positive grows, negative shrinks. */
    sweep: number;
    /** Whether the sweep closes a complete circle. */
    fullTurn: boolean;
}

/**
 * Normalises an angle onto the half-open range `[0, 2π)`.
 * @param {number} angle - The angle to normalise, in radians.
 * @returns {number} The equivalent angle in the range `[0, 2π)`.
 * @category scene
 * @standard
 */
export function normalizeAngle(angle: number): number
{
    const wrapped = angle % FULL_TURN;

    return wrapped < 0 ? wrapped + FULL_TURN : wrapped;
}

/**
 * Resolves how much angle an arc actually travels from its start to its end.
 *
 * The raw difference between the two angles is wrapped onto at most one turn
 * according to the requested direction, which is the one place the full-turn
 * wraparound and reverse-direction angle rules are allowed to live:
 *
 * - growing angles produce a sweep in the half-open range `[0, 2π)`;
 * - shrinking angles produce a sweep in the half-open range `(-2π, 0]`.
 *
 * Coincident endpoints collapse to a point unless `zeroSweepMode` asks for a
 * closed circle.
 * @param {number} startAngle - The starting angle, in radians.
 * @param {number} endAngle - The ending angle, in radians.
 * @param {boolean} increasing - `true` travels towards larger angles, `false`
 *  towards smaller angles.
 * @param {ResolveArcSweepOptions} [options] - Optional resolution rules.
 * @returns {ArcSweep} The resolved sweep, including the wrapped end angle.
 * @category scene
 * @standard
 */
export function resolveArcSweep(
    startAngle: number,
    endAngle: number,
    increasing: boolean,
    options: ResolveArcSweepOptions = {}
): ArcSweep
{
    let sweep = endAngle - startAngle;

    if (increasing)
    {
        // Wrap onto [0, 2π): subtract every whole turn beyond the first.
        if (sweep >= FULL_TURN)
        {
            sweep %= FULL_TURN;
        }
        else if (sweep < 0)
        {
            sweep = FULL_TURN + (sweep % FULL_TURN);
        }
    }
    else if (sweep <= -FULL_TURN)
    {
        // Wrap onto (-2π, 0]: shrink means travelling with a negative sign.
        sweep %= FULL_TURN;
    }
    else if (sweep > 0)
    {
        sweep = -FULL_TURN + (sweep % FULL_TURN);
    }

    // Correct a negative-zero remainder back onto the start point.
    if (Object.is(sweep, -0))
    {
        sweep = 0;
    }

    let fullTurn = Math.abs(Math.abs(sweep) - FULL_TURN) <= FULL_TURN_EPSILON;

    // Coincident endpoints can either collapse to a point or close a circle.
    if (sweep === 0 && options.zeroSweepMode === 'fullTurn')
    {
        sweep = increasing ? FULL_TURN : -FULL_TURN;
        fullTurn = true;
    }

    return {
        startAngle,
        endAngle: startAngle + sweep,
        sweep,
        fullTurn,
    };
}

/**
 * Unsigned angular distance from `angle` to the closest angle covered by the
 * sweep. Returns `0` when the angle lies on the swept arc.
 *
 * Membership of the light strip is decided from the same resolved sweep that
 * builds the marker path, never from a second angle calculation.
 * @param {number} angle - The angle to test, in radians.
 * @param {ArcSweep} resolved - A sweep previously resolved with
 *  {@link resolveArcSweep}.
 * @returns {number} The distance in radians, always greater than or equal to zero.
 * @category scene
 * @standard
 */
export function angularDistanceToSweep(angle: number, resolved: ArcSweep): number
{
    const { startAngle, sweep, fullTurn } = resolved;

    if (fullTurn)
    {
        return 0;
    }

    // Distance travelled from the start along the sweep's direction, in [0, 2π).
    let travelled = normalizeAngle(angle - startAngle);

    if (sweep < 0)
    {
        travelled = (FULL_TURN - travelled) % FULL_TURN;
    }

    const magnitude = Math.abs(sweep);

    if (travelled <= magnitude)
    {
        return 0;
    }

    // Closest covered angle is the end of the sweep.
    return travelled - magnitude;
}

export { FULL_TURN, FULL_TURN_EPSILON };
