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
    urls: string[];
    className?: string;
    onLoad?: () => void;
    gain?: number;
    depth?: number;
    frame: number;
    onFrameChange: (frame: number) => void;
}

const DicomViewer: React.FC<DicomViewerProps> = ({
    urls = [],
    className = '',
    onLoad,
    gain = 50,
    depth = 15,
    frame = 0,
    onFrameChange
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
        if (!element || urls.length === 0) return;

        // Enable the element for cornerstone
        cornerstone.enable(element);

        // Load and display the DICOM image
        const currentUrl = urls[Math.min(frame, urls.length - 1)];
        const imageId = `wadouri:${window.location.origin}${currentUrl}`;

        cornerstone.loadImage(imageId)
            .then((image: any) => {
                // Get default viewport or keep existing
                let viewport;
                try {
                     viewport = cornerstone.getViewport(element);
                } catch(e) {}
                
                if (!viewport) {
                     viewport = cornerstone.getDefaultViewportForImage(element, image);
                }

                // Apply gain/contrast adjustment (window width/center)
                // We preserve other viewport properties (zoom/pan) when changing frames if possible
                if (viewport) {
                    viewport.voi = {
                        windowWidth: 400 - (gain - 50) * 4,
                        windowCenter: 40 + (gain - 50) * 2
                    };
                }

                // Display the image
                cornerstone.displayImage(element, image, viewport);

                setIsLoaded(true);
                setImageInfo(`${image.width}x${image.height} | Frame ${frame + 1}/${urls.length}`);

                // Fit to window only on first load
                if (!isLoaded) {
                     setTimeout(fitToWindow, 100);
                     onLoad?.();
                }
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
            // Don't disable here to avoid flickering between frame updates
        };
    }, [frame, urls, gain]); // Re-run when frame changes

    // Update viewport when gain changes (redundant due to dependency above but good for explicit updates)
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
        } catch (e) {}
    }, [gain, isLoaded]);

    // Handle mouse wheel for scrolling frames
    const handleWheel = (e: React.WheelEvent) => {
        const element = containerRef.current;
        if (!element || !isLoaded) return;

        e.preventDefault();
        
        // Scroll Logic
        if (urls.length > 1) {
            const direction = e.deltaY > 0 ? 1 : -1;
            let newFrame = frame + direction;
            if (newFrame < 0) newFrame = 0;
            if (newFrame >= urls.length) newFrame = urls.length - 1;
            
            if (newFrame !== frame) {
                onFrameChange(newFrame);
            }
        }
    };

    // Handle double-click to reset
    const handleDoubleClick = () => {
        const element = containerRef.current;
        if (!element || !isLoaded) return;

        cornerstone.reset(element);
        fitToWindow();
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
                    DICOM {imageInfo} | Scroll: Change Frame | Double-click: Reset
                </div>
            )}
        </div>
    );
};

export default DicomViewer;
