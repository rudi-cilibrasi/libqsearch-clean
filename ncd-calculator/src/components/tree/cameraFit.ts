export interface TreeExtent {
    x: number;
    y: number;
    z: number;
}

/**
 * Calculate the camera distance required to contain a 3D extent.
 *
 * The narrower of the horizontal and vertical fields of view is used so the
 * result remains fully visible in both landscape and portrait viewports.
 */
export const calculateCameraFitDistance = (
    extent: TreeExtent,
    verticalFovDegrees: number,
    aspectRatio: number,
    paddingFactor = 1.3
): number => {
    const safeAspectRatio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1;
    const safeVerticalFov = Math.min(Math.max(verticalFovDegrees, 1), 179) * Math.PI / 180;
    const horizontalFov = 2 * Math.atan(Math.tan(safeVerticalFov / 2) * safeAspectRatio);
    const horizontalDistance = (Math.max(extent.x, 1) / 2) / Math.tan(horizontalFov / 2);
    const verticalDistance = (Math.max(extent.y, 1) / 2) / Math.tan(safeVerticalFov / 2);
    const depthAllowance = Math.max(extent.z, 0) / 2;
    const distance = Math.max(horizontalDistance, verticalDistance) + depthAllowance;

    return Math.max(distance * Math.max(paddingFactor, 1), 1);
};
