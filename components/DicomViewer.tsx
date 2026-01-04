import React, { useEffect, useRef, useState } from 'react';
import * as cornerstone from 'cornerstone-core';
import * as cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import * as dicomParser from 'dicom-parser';

// Configure cornerstone WADO image loader
cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

// Configure web worker for parsing (optional, improves performance)
cornerstoneWADOImageLoader.webWorkerManager.initialize({
    maxWebWorkers: navigator.hardwareConcurrency || 1,
    startWebWorkersOnDemand: true,
    taskConfiguration: {
        decodeTask: {
            initializeCodecsOnStartup: false,
            usePDFJS: false
        }
    }
});

interface DicomViewerProps {
    dicomUrl?: string;
    className?: string;
    onLoad?: () => void;
    gain?: number;
    depth?: number;
}

const DicomViewer: React.FC<DicomViewerProps> = ({
    dicomUrl = '/sample.dcm',
    className = '',
    onLoad,
    gain = 50,
    depth = 15
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [imageInfo, setImageInfo] = useState<string>('');

    // Fit image to window
    const fitToWindow = () => {
        const element = containerRef.current;
        if (!element) return;

        try {
            cornerstone.resize(element, true);
            const viewport = cornerstone.getViewport(element);
            if (viewport) {
                // Get element dimensions
                const rect = element.getBoundingClientRect();
                const image = cornerstone.getImage(element);
                if (image && rect.width > 0 && rect.height > 0) {
                    // Calculate scale to fit
                    const scaleX = rect.width / image.width;
                    const scaleY = rect.height / image.height;
                    viewport.scale = Math.min(scaleX, scaleY) * 0.95; // 95% to leave some margin
                    cornerstone.setViewport(element, viewport);
                }
            }
        } catch (e) {
            // Not ready yet
        }
    };

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        // Enable the element for cornerstone
        cornerstone.enable(element);

        // Load and display the DICOM image
        const imageId = `wadouri:${window.location.origin}${dicomUrl}`;

        cornerstone.loadImage(imageId)
            .then((image: any) => {
                // Get default viewport
                const viewport = cornerstone.getDefaultViewportForImage(element, image);

                // Apply gain/contrast adjustment (window width/center)
                viewport.voi = {
                    windowWidth: 400 - (gain - 50) * 4,
                    windowCenter: 40 + (gain - 50) * 2
                };

                // Display the image
                cornerstone.displayImage(element, image, viewport);

                setIsLoaded(true);
                setImageInfo(`${image.width}x${image.height}`);

                // Fit to window after a short delay
                setTimeout(fitToWindow, 100);

                onLoad?.();
            })
            .catch((err: Error) => {
                console.error('Error loading DICOM:', err);
                setError(`Failed to load DICOM: ${err.message}`);
            });

        // Handle window resize
        const handleResize = () => fitToWindow();
        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            if (element) {
                try {
                    cornerstone.disable(element);
                } catch (e) {
                    // Element might already be disabled
                }
            }
        };
    }, [dicomUrl]);

    // Update viewport when gain changes
    useEffect(() => {
        const element = containerRef.current;
        if (!element || !isLoaded) return;

        try {
            const viewport = cornerstone.getViewport(element);
            if (viewport) {
                viewport.voi = {
                    windowWidth: 400 - (gain - 50) * 4,
                    windowCenter: 40 + (gain - 50) * 2
                };
                cornerstone.setViewport(element, viewport);
            }
        } catch (e) {
            // Viewport not ready
        }
    }, [gain, isLoaded]);

    // Handle mouse wheel for zoom
    const handleWheel = (e: React.WheelEvent) => {
        const element = containerRef.current;
        if (!element || !isLoaded) return;

        e.preventDefault();
        const viewport = cornerstone.getViewport(element);
        if (viewport) {
            const scaleFactor = e.deltaY > 0 ? 0.95 : 1.05;
            viewport.scale *= scaleFactor;
            cornerstone.setViewport(element, viewport);
        }
    };

    // Handle double-click to reset
    const handleDoubleClick = () => {
        const element = containerRef.current;
        if (!element || !isLoaded) return;

        cornerstone.reset(element);
    };

    return (
        <div className={`relative h-full w-full ${className}`}>
            <div
                ref={containerRef}
                className="absolute inset-0 bg-black"
                onWheel={handleWheel}
                onDoubleClick={handleDoubleClick}
            />

            {/* Loading state */}
            {!isLoaded && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black">
                    <div className="text-center">
                        <div className="w-8 h-8 border-2 border-rology-accent border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        <p className="text-slate-400 text-sm">Loading DICOM...</p>
                    </div>
                </div>
            )}

            {/* Error state */}
            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black">
                    <div className="text-center p-4">
                        <div className="text-red-500 text-4xl mb-2">⚠</div>
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                </div>
            )}

            {/* Info overlay */}
            {isLoaded && (
                <div className="absolute bottom-2 right-2 text-[10px] text-cyan-400 bg-black/50 px-2 py-1 rounded">
                    DICOM {imageInfo} | Scroll: Zoom | Double-click: Reset
                </div>
            )}
        </div>
    );
};

export default DicomViewer;
