import React, {useState} from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {CameraTrackerProps} from './types';

/**
 * Component to track camera position for the minimap
 * Passes the current camera position to children
 */
const CameraTracker: React.FC<CameraTrackerProps> = ({children}) => {
    const {camera} = useThree();
    const [position, setPosition] = useState(new THREE.Vector3());

    useFrame(() => {
        setPosition(camera.position.clone());
    });

    return <>{children(position)}</>;
};

export default CameraTracker;
