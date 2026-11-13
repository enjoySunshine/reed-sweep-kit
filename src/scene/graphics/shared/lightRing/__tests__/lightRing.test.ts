import {
    buildLightRingMarker,
    buildMonitoringSeatHalfRing,
    isPointOnLight,
    normalizeAngle,
    resolveArcSweep,
    sampleLightStrip,
} from '../index';

import type { LightRingGeometry } from '../index';

/** The geometry every monitoring-seat ring shares. */
const GEOMETRY: LightRingGeometry = {
    centerX: 0,
    centerY: 0,
    radius: 16,
    strokeWidth: 2,
};

/** Rounded coordinate used in the spec for the 45-degree points. */
const DIAGONAL = 11.31;

describe('monitoring-seat half light ring', () =>
{
    describe('first ring: angles grow from 0 to π', () =>
    {
        const ring = buildMonitoringSeatHalfRing(true);

        it('resolves a single positive half-turn sweep', () =>
        {
            expect(ring.resolved.startAngle).toBe(0);
            expect(ring.resolved.endAngle).toBeCloseTo(Math.PI, 12);
            expect(ring.resolved.sweep).toBeCloseTo(Math.PI, 12);
            expect(ring.resolved.fullTurn).toBe(false);
        });

        it('produces the exact path data', () =>
        {
            expect(ring.marker.pathData).toBe('M16 0A16 16 0 0 1 -16 0');
        });

        it('paints a white unfilled stroke of width 2', () =>
        {
            expect(ring.marker.stroke).toBe('#ffffff');
            expect(ring.marker.fill).toBe('none');
            expect(ring.marker.strokeWidth).toBe(2);
        });

        it('produces the exact viewport', () =>
        {
            expect(ring.marker.viewBox).toEqual({
                x: -17.01,
                y: -1.01,
                width: 34.01,
                height: 17.92,
            });
        });

        it('produces the exact outer frame', () =>
        {
            expect(ring.marker.frame).toEqual({
                left: -17.01,
                top: -1.01,
                right: 17.01,
                bottom: 16.92,
            });
        });

        it('keeps the points of the upper half on the light', () =>
        {
            expect(ring.isPointOnLight(16, 0)).toBe(true);
            expect(ring.isPointOnLight(-16, 0)).toBe(true);
            expect(ring.isPointOnLight(0, 16)).toBe(true);
            expect(ring.isPointOnLight(DIAGONAL, DIAGONAL)).toBe(true);
        });

        it('keeps the points of the lower half off the light', () =>
        {
            expect(ring.isPointOnLight(0, -16)).toBe(false);
            expect(ring.isPointOnLight(DIAGONAL, -DIAGONAL)).toBe(false);
        });
    });

    describe('second ring: angles shrink from 0 to π', () =>
    {
        const ring = buildMonitoringSeatHalfRing(false);

        it('resolves a single negative half-turn sweep with the same endpoints', () =>
        {
            expect(ring.resolved.startAngle).toBe(0);
            expect(ring.resolved.endAngle).toBeCloseTo(-Math.PI, 12);
            expect(ring.resolved.sweep).toBeCloseTo(-Math.PI, 12);
            expect(ring.resolved.fullTurn).toBe(false);
        });

        it('produces the exact path data', () =>
        {
            expect(ring.marker.pathData).toBe('M16 0A16 16 0 0 0 -16 0');
        });

        it('paints a white unfilled stroke of width 2', () =>
        {
            expect(ring.marker.stroke).toBe('#ffffff');
            expect(ring.marker.fill).toBe('none');
            expect(ring.marker.strokeWidth).toBe(2);
        });

        it('produces the exact viewport', () =>
        {
            expect(ring.marker.viewBox).toEqual({
                x: -17.01,
                y: -16.92,
                width: 34.01,
                height: 17.92,
            });
        });

        it('produces the exact outer frame', () =>
        {
            expect(ring.marker.frame).toEqual({
                left: -17.01,
                top: -16.92,
                right: 17.01,
                bottom: 1.01,
            });
        });

        it('keeps the points of the lower half on the light', () =>
        {
            expect(ring.isPointOnLight(16, 0)).toBe(true);
            expect(ring.isPointOnLight(-16, 0)).toBe(true);
            expect(ring.isPointOnLight(0, -16)).toBe(true);
            expect(ring.isPointOnLight(DIAGONAL, -DIAGONAL)).toBe(true);
        });

        it('keeps the points of the upper half off the light', () =>
        {
            expect(ring.isPointOnLight(0, 16)).toBe(false);
            expect(ring.isPointOnLight(DIAGONAL, DIAGONAL)).toBe(false);
        });
    });

    describe('one shared angular calculation', () =>
    {
        it('lets the marker and the strip consume the same resolved sweep', () =>
        {
            const { marker, resolved } = buildLightRingMarker(GEOMETRY, 0, Math.PI, true);
            const points = sampleLightStrip(GEOMETRY, resolved, 8);

            expect(marker.pathData).toBe('M16 0A16 16 0 0 1 -16 0');

            // Sampling starts and ends exactly on the path endpoints.
            expect(points[0].x).toBeCloseTo(16, 12);
            expect(points[0].y).toBeCloseTo(0, 12);
            expect(points[points.length - 1].x).toBeCloseTo(-16, 12);
            expect(points[points.length - 1].y).toBeCloseTo(0, 12);

            // Every sampled point is itself on the light by construction.
            for (const point of points)
            {
                expect(isPointOnLight(point.x, point.y, GEOMETRY, resolved)).toBe(true);
            }
        });

        it('orders reverse-direction samples by shrinking angle', () =>
        {
            const resolved = resolveArcSweep(0, Math.PI, false);
            const points = sampleLightStrip(GEOMETRY, resolved, 4);

            expect(points[0].angle).toBeCloseTo(0, 12);
            expect(points[points.length - 1].angle).toBeCloseTo(-Math.PI, 12);

            for (let i = 1; i < points.length; i++)
            {
                expect(points[i].angle).toBeLessThan(points[i - 1].angle);
            }
        });

        it('wraps a backwards-growing angle range onto one full turn', () =>
        {
            // Coincident endpoints only close a circle when explicitly requested.
            const collapsed = resolveArcSweep(0, 0, false);

            expect(collapsed.fullTurn).toBe(false);
            expect(collapsed.sweep).toBe(0);

            const resolved = resolveArcSweep(0, 0, false, { zeroSweepMode: 'fullTurn' });

            expect(resolved.fullTurn).toBe(true);
            expect(resolved.sweep).toBeCloseTo(-Math.PI * 2, 12);

            const { marker } = buildLightRingMarker(
                GEOMETRY, 0, 0, false, { zeroSweepMode: 'fullTurn' }
            );

            // A full circle touches every cardinal point of the centreline.
            expect(isPointOnLight(0, 16, GEOMETRY, resolved)).toBe(true);
            expect(isPointOnLight(0, -16, GEOMETRY, resolved)).toBe(true);
            expect(isPointOnLight(16, 0, GEOMETRY, resolved)).toBe(true);
            expect(isPointOnLight(-16, 0, GEOMETRY, resolved)).toBe(true);
            expect(marker.pathData.startsWith('M16 0A16 16 0 0 0')).toBe(true);
        });

        it('caps any angle range at one full turn and keeps the direction sign', () =>
        {
            // 3π forward is one full turn plus π; only the wrapped π survives.
            const forward = resolveArcSweep(0, Math.PI * 3, true);

            expect(forward.fullTurn).toBe(false);
            expect(forward.sweep).toBeCloseTo(Math.PI, 12);
            expect(normalizeAngle(forward.endAngle)).toBeCloseTo(Math.PI, 12);

            // The same request backwards keeps a negative sweep.
            const backward = resolveArcSweep(0, Math.PI * 3, false);

            expect(backward.sweep).toBeCloseTo(-Math.PI, 12);
        });
    });
});
