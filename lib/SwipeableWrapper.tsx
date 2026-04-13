import React, { useEffect, useState } from 'react';
import { Dimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    Extrapolation,
    interpolate,
    runOnJS,
    useAnimatedReaction,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    type SharedValue,
} from 'react-native-reanimated';
import { useSwipeDeckContext } from './SwipeDeckContext';
import { styles } from './styles/SwipeableWrapper.styles';
import { SwipeDirection, SwipeOverlayConfig, SwipeStatus } from './types';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export interface SwipeableWrapperProps {
    children: React.ReactNode;
    status?: SwipeStatus;
    direction?: SwipeDirection;
    id: number;
    overlayConfig?: SwipeOverlayConfig;
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
    onCardPress?: () => void;
    frontCardTranslateX?: SharedValue<number>;
    frontCardTranslateY?: SharedValue<number>;
}

const SWIPE_THRESHOLD = screenWidth * 0.35;
const VELOCITY_THRESHOLD = 800;
const MAX_OPACITY_THRESHOLD_WIDTH = screenWidth * 0.75;
const MAX_OPACITY_THRESHOLD_HEIGHT = screenHeight * 0.5;
const ICONMINOPACITY = 0.5;
const ICONMAXOPACITY = 0.8;

export const SwipeableWrapper: React.FC<SwipeableWrapperProps> = ({
    children,
    status = 'idle',
    direction,
    id,
    overlayConfig,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onCardPress,
    frontCardTranslateX,
    frontCardTranslateY,
}) => {
    const { swipeableStatuses } = useSwipeDeckContext();
    const [isTop, setIsTop] = useState<boolean>(false);

    // Set the correct initial value after mount — avoids reading .value during render
    useEffect(() => {
        const firstIdle = swipeableStatuses.value.find(s => s.status === 'idle');
        setIsTop(firstIdle?.id === id);
    }, []);

    useAnimatedReaction(
        () => {
            const firstIdle = swipeableStatuses.value.find(s => s.status === 'idle');
            return firstIdle?.id === id;
        },
        (current, previous) => {
            if (current !== previous) {
                runOnJS(setIsTop)(current);
            }
        }
    );

    // Initialize positions based on status to prevent the (0,0) flash on mount
    const getInitialX = () => {
        if (status !== 'animating-in') return 0;
        if (direction === 'left') return -screenWidth;
        if (direction === 'right') return screenWidth;
        return 0;
    };

    const getInitialY = () => {
        if (status !== 'animating-in') return 0;
        if (direction === 'up') return -screenHeight;
        if (direction === 'down') return screenHeight;
        return 0;
    };

    const translateX = useSharedValue(getInitialX());
    const translateY = useSharedValue(getInitialY());
    const rotationZ = useSharedValue(0);

    // Using SharedValues for these allows the UI thread to access the
    // measurements instantly for animations without waiting for React re-renders.
    const swipeableWidth = useSharedValue(0);
    const swipeableHeight = useSharedValue(0);

    // Store velocities onEnd for use in the animation effect
    const velocityX = useSharedValue(0);
    const velocityY = useSharedValue(0);

    // True when the gesture itself already started the fly-away animation,
    // so the useEffect for 'animating-out' knows to skip its duplicate animation.
    const dismissedByGesture = useSharedValue(false);

    const panGesture = Gesture.Pan()
        .enabled(isTop)
        .onUpdate((event) => {
            if (dismissedByGesture.value) return;
            translateX.value = event.translationX;
            translateY.value = event.translationY;
            if (frontCardTranslateX) frontCardTranslateX.value = event.translationX;
            if (frontCardTranslateY) frontCardTranslateY.value = event.translationY;
        })
        .onEnd((event) => {
            if (dismissedByGesture.value) return;
            velocityX.value = event.velocityX;
            velocityY.value = event.velocityY;

            const shouldSwipeRight = translateX.value > SWIPE_THRESHOLD || (event.velocityX > VELOCITY_THRESHOLD && translateX.value > 0);
            const shouldSwipeLeft = translateX.value < -SWIPE_THRESHOLD || (event.velocityX < -VELOCITY_THRESHOLD && translateX.value < 0);
            const shouldSwipeUp = translateY.value < -SWIPE_THRESHOLD || (event.velocityY < -VELOCITY_THRESHOLD && translateY.value < 0);
            const shouldSwipeDown = translateY.value > SWIPE_THRESHOLD || (event.velocityY > VELOCITY_THRESHOLD && translateY.value > 0);

            const absX = Math.abs(translateX.value);
            const absY = Math.abs(translateY.value);
            const isHorizontalDominant = absX > absY;

            const currentWidth = swipeableWidth.value || screenWidth;
            const currentHeight = swipeableHeight.value || screenHeight;
            const horizontalExit = (screenWidth / 2) + (currentWidth / 2) + 100;
            const verticalExit = (screenHeight / 2) + (currentHeight / 2) + 100;

            const calcDur = (target: number, current: number, velocity: number) => {
                'worklet';
                const absVelocity = Math.abs(velocity);
                if (absVelocity > 50) {
                    return Math.min(300, Math.max(100, (Math.abs(target - current) / absVelocity) * 1000));
                }
                return 300;
            };

            if (isHorizontalDominant && shouldSwipeRight) {
                swipeableStatuses.value = swipeableStatuses.value.map(s =>
                    s.id === id ? { id: s.id, status: 'animating-out' as const, direction: 'right' as const } : s
                );
                dismissedByGesture.value = true;
                const dur = calcDur(horizontalExit, translateX.value, event.velocityX);
                translateX.value = withTiming(horizontalExit, { duration: dur, easing: Easing.in(Easing.quad) }, (finished) => {
                    if (finished) {
                        swipeableStatuses.value = swipeableStatuses.value.map(s =>
                            s.id === id ? { id: s.id, status: 'done-animating' as const } : s
                        );
                        if (frontCardTranslateX) frontCardTranslateX.value = 0;
                        if (frontCardTranslateY) frontCardTranslateY.value = 0;
                    }
                });
                if (frontCardTranslateX) frontCardTranslateX.value = withTiming(horizontalExit, { duration: dur, easing: Easing.in(Easing.quad) });
                if (onSwipeRight) runOnJS(onSwipeRight)();
            } else if (isHorizontalDominant && shouldSwipeLeft) {
                swipeableStatuses.value = swipeableStatuses.value.map(s =>
                    s.id === id ? { id: s.id, status: 'animating-out' as const, direction: 'left' as const } : s
                );
                dismissedByGesture.value = true;
                const dur = calcDur(-horizontalExit, translateX.value, event.velocityX);
                translateX.value = withTiming(-horizontalExit, { duration: dur, easing: Easing.in(Easing.quad) }, (finished) => {
                    if (finished) {
                        swipeableStatuses.value = swipeableStatuses.value.map(s =>
                            s.id === id ? { id: s.id, status: 'done-animating' as const } : s
                        );
                        if (frontCardTranslateX) frontCardTranslateX.value = 0;
                        if (frontCardTranslateY) frontCardTranslateY.value = 0;
                    }
                });
                if (frontCardTranslateX) frontCardTranslateX.value = withTiming(-horizontalExit, { duration: dur, easing: Easing.in(Easing.quad) });
                if (onSwipeLeft) runOnJS(onSwipeLeft)();
            } else if (!isHorizontalDominant && shouldSwipeUp) {
                swipeableStatuses.value = swipeableStatuses.value.map(s =>
                    s.id === id ? { id: s.id, status: 'animating-out' as const, direction: 'up' as const } : s
                );
                dismissedByGesture.value = true;
                const dur = calcDur(-verticalExit, translateY.value, event.velocityY);
                translateY.value = withTiming(-verticalExit, { duration: dur, easing: Easing.in(Easing.quad) }, (finished) => {
                    if (finished) {
                        swipeableStatuses.value = swipeableStatuses.value.map(s =>
                            s.id === id ? { id: s.id, status: 'done-animating' as const } : s
                        );
                        if (frontCardTranslateX) frontCardTranslateX.value = 0;
                        if (frontCardTranslateY) frontCardTranslateY.value = 0;
                    }
                });
                if (frontCardTranslateY) frontCardTranslateY.value = withTiming(-verticalExit, { duration: dur, easing: Easing.in(Easing.quad) });
                if (onSwipeUp) runOnJS(onSwipeUp)();
            } else if (!isHorizontalDominant && shouldSwipeDown) {
                swipeableStatuses.value = swipeableStatuses.value.map(s =>
                    s.id === id ? { id: s.id, status: 'animating-out' as const, direction: 'down' as const } : s
                );
                dismissedByGesture.value = true;
                const dur = calcDur(verticalExit, translateY.value, event.velocityY);
                translateY.value = withTiming(verticalExit, { duration: dur, easing: Easing.in(Easing.quad) }, (finished) => {
                    if (finished) {
                        swipeableStatuses.value = swipeableStatuses.value.map(s =>
                            s.id === id ? { id: s.id, status: 'done-animating' as const } : s
                        );
                        if (frontCardTranslateX) frontCardTranslateX.value = 0;
                        if (frontCardTranslateY) frontCardTranslateY.value = 0;
                    }
                });
                if (frontCardTranslateY) frontCardTranslateY.value = withTiming(verticalExit, { duration: dur, easing: Easing.in(Easing.quad) });
                if (onSwipeDown) runOnJS(onSwipeDown)();
            } else {
                translateX.value = withTiming(0, { duration: 300 });
                translateY.value = withTiming(0, { duration: 300 });
                if (frontCardTranslateX) frontCardTranslateX.value = withTiming(0, { duration: 300 });
                if (frontCardTranslateY) frontCardTranslateY.value = withTiming(0, { duration: 300 });
            }
        });

    const tapGesture = Gesture.Tap()
        .enabled(isTop)
        .maxDistance(10)
        .maxDuration(250)
        .onEnd(() => {
            if (onCardPress) runOnJS(onCardPress)();
        });

    const gesture = Gesture.Simultaneous(panGesture, tapGesture);


    // ----------------------------- SWIPE ANIMATION -----------------------------

    const calculateDuration = (target: number, translate: number, velocity: number) => {
        let duration = 300;
        const absDistance = Math.abs(target - translate);
        const absVelocity = Math.abs(velocity);
        if (absVelocity > 50) {
            duration = Math.min(300, Math.max(150, (absDistance / absVelocity) * 1000));
        }
        return duration;
    }

    useEffect(() => {
        // Calculate exact exit/start targets based on measured size
        // Fallback to constants if onLayout hasn't fired yet (common on mount)
        const currentWidth = swipeableWidth.value || screenWidth;
        const currentHeight = swipeableHeight.value || screenHeight;
        const horizontalExit = (screenWidth / 2) + (currentWidth / 2) + 100;
        const verticalExit = (screenHeight / 2) + (currentHeight / 2) + 100;

        if (status === 'animating-out') {
            if (dismissedByGesture.value) {
                dismissedByGesture.value = false;
                return;
            }

            let targetX: number;
            let targetY: number;

            const currentX = translateX.value;
            const currentY = translateY.value;

            switch (direction) {
                case 'left': targetX = -horizontalExit; targetY = currentY; break;
                case 'right': targetX = horizontalExit; targetY = currentY; break;
                case 'up': targetX = currentX; targetY = -verticalExit; break;
                case 'down': targetX = currentX; targetY = verticalExit; break;
                default: throw new Error(`Swipeable: direction must be provided when animating. Current: ${direction}`);
            }

            let duration = 300;

            if (direction === 'left' || direction === 'right') {
                duration = calculateDuration(targetX, translateX.value, velocityX.value);

                translateY.value = withTiming(targetY, { duration, easing: Easing.in(Easing.quad) });
                translateX.value = withTiming(targetX, { duration, easing: Easing.in(Easing.quad) }, (finished) => {
                    if (finished) {
                        swipeableStatuses.value = swipeableStatuses.value.map(s =>
                            s.id === id ? { id: s.id, status: 'done-animating' as const } : s
                        );
                        if (frontCardTranslateX) frontCardTranslateX.value = 0;
                        if (frontCardTranslateY) frontCardTranslateY.value = 0;
                    }
                });
                if (frontCardTranslateX) frontCardTranslateX.value = withTiming(targetX, { duration, easing: Easing.in(Easing.quad) });
                if (frontCardTranslateY) frontCardTranslateY.value = withTiming(targetY, { duration, easing: Easing.in(Easing.quad) });

            } else if (direction === 'up' || direction === 'down') {
                duration = calculateDuration(targetY, translateY.value, velocityY.value);

                translateX.value = withTiming(targetX, { duration, easing: Easing.in(Easing.quad) });
                translateY.value = withTiming(targetY, { duration, easing: Easing.in(Easing.quad) }, (finished) => {
                    if (finished) {
                        swipeableStatuses.value = swipeableStatuses.value.map(s =>
                            s.id === id ? { id: s.id, status: 'done-animating' as const } : s
                        );
                        if (frontCardTranslateX) frontCardTranslateX.value = 0;
                        if (frontCardTranslateY) frontCardTranslateY.value = 0;
                    }
                });
                if (frontCardTranslateX) frontCardTranslateX.value = withTiming(targetX, { duration, easing: Easing.in(Easing.quad) });
                if (frontCardTranslateY) frontCardTranslateY.value = withTiming(targetY, { duration, easing: Easing.in(Easing.quad) });
            }
        } else if (status === 'animating-in') {

            // Animate back to center
            translateX.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) });
            translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) }, (finished) => {
                if (finished) {
                    swipeableStatuses.value = swipeableStatuses.value.map(s =>
                        s.id === id ? { id: s.id, status: 'idle' as const } : s
                    );
                }
            });
            if (frontCardTranslateX) frontCardTranslateX.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) });
            if (frontCardTranslateY) frontCardTranslateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) });
        } else if (status === 'idle') {
            translateX.value = withTiming(0, { duration: 300 });
            translateY.value = withTiming(0, { duration: 300 });
        }
    }, [status, direction]);

    const animatedStyle = useAnimatedStyle(() => {
        const rotationZFromX = interpolate(translateX.value, [-screenWidth, 0, screenWidth], [-15, 0, 15]);
        const rotationZFromY = interpolate(translateY.value, [-screenWidth, 0, screenWidth], [10, 0, -10]);
        rotationZ.value = rotationZFromX + rotationZFromY;

        return {
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value },
                { rotateZ: `${rotationZ.value}deg` },
            ],
        };
    });

    const rightOverlayStyle = useAnimatedStyle(() => {
        const absX = Math.abs(translateX.value);
        const absY = Math.abs(translateY.value);
        if (absX < absY || translateX.value <= 0) return { opacity: 0 };
        const maxOpacity = overlayConfig?.right?.maxOpacity ?? 1;
        return { opacity: interpolate(translateX.value, [0, MAX_OPACITY_THRESHOLD_WIDTH], [0, maxOpacity], Extrapolation.CLAMP) };
    });

    const leftOverlayStyle = useAnimatedStyle(() => {
        const absX = Math.abs(translateX.value);
        const absY = Math.abs(translateY.value);
        if (absX < absY || translateX.value >= 0) return { opacity: 0 };
        const maxOpacity = overlayConfig?.left?.maxOpacity ?? 1;
        return { opacity: interpolate(-translateX.value, [0, MAX_OPACITY_THRESHOLD_WIDTH], [0, maxOpacity], Extrapolation.CLAMP) };
    });

    const upOverlayStyle = useAnimatedStyle(() => {
        const absX = Math.abs(translateX.value);
        const absY = Math.abs(translateY.value);
        if (absY < absX || translateY.value >= 0) return { opacity: 0 };
        const maxOpacity = overlayConfig?.up?.maxOpacity ?? 1;
        return { opacity: interpolate(-translateY.value, [0, MAX_OPACITY_THRESHOLD_HEIGHT], [0, maxOpacity], Extrapolation.CLAMP) };
    });

    const downOverlayStyle = useAnimatedStyle(() => {
        const absX = Math.abs(translateX.value);
        const absY = Math.abs(translateY.value);
        if (absY < absX || translateY.value <= 0) return { opacity: 0 };
        const maxOpacity = overlayConfig?.down?.maxOpacity ?? 1;
        return { opacity: interpolate(translateY.value, [0, MAX_OPACITY_THRESHOLD_HEIGHT], [0, maxOpacity], Extrapolation.CLAMP) };
    });

    const rightIconStyle = useAnimatedStyle(() => {
        const absX = Math.abs(translateX.value);
        const absY = Math.abs(translateY.value);
        const isHorizontalDominant = absX >= absY;
        const shouldSwipeRight = translateX.value > SWIPE_THRESHOLD;
        if (isHorizontalDominant && shouldSwipeRight) {
            return { opacity: interpolate(translateX.value, [SWIPE_THRESHOLD, screenWidth], [ICONMINOPACITY, ICONMAXOPACITY], Extrapolation.CLAMP) };
        }
        return { opacity: 0 };
    });

    const leftIconStyle = useAnimatedStyle(() => {
        const absX = Math.abs(translateX.value);
        const absY = Math.abs(translateY.value);
        const isHorizontalDominant = absX >= absY;
        const shouldSwipeLeft = translateX.value < -SWIPE_THRESHOLD;
        if (isHorizontalDominant && shouldSwipeLeft) {
            return { opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, -screenWidth], [ICONMINOPACITY, ICONMAXOPACITY], Extrapolation.CLAMP) };
        }
        return { opacity: 0 };
    });

    const upIconStyle = useAnimatedStyle(() => {
        const absX = Math.abs(translateX.value);
        const absY = Math.abs(translateY.value);
        const isHorizontalDominant = absX >= absY;
        const shouldSwipeUp = translateY.value < -SWIPE_THRESHOLD;
        if (!isHorizontalDominant && shouldSwipeUp) {
            return { opacity: interpolate(translateY.value, [-SWIPE_THRESHOLD, -screenWidth], [ICONMINOPACITY, ICONMAXOPACITY], Extrapolation.CLAMP) };
        }
        return { opacity: 0 };
    });

    const downIconStyle = useAnimatedStyle(() => {
        const absX = Math.abs(translateX.value);
        const absY = Math.abs(translateY.value);
        const isHorizontalDominant = absX >= absY;
        const shouldSwipeDown = translateY.value > SWIPE_THRESHOLD;
        if (!isHorizontalDominant && shouldSwipeDown) {
            return { opacity: interpolate(translateY.value, [SWIPE_THRESHOLD, screenWidth], [ICONMINOPACITY, ICONMAXOPACITY], Extrapolation.CLAMP) };
        }
        return { opacity: 0 };
    });

    return (
        <View
            pointerEvents={isTop ? 'auto' : 'none'}
            style={styles.container}>
            <GestureDetector gesture={gesture}>
                <Animated.View
                    style={animatedStyle}
                    onLayout={(event) => {
                        swipeableWidth.value = event.nativeEvent.layout.width;
                        swipeableHeight.value = event.nativeEvent.layout.height;
                    }}
                >
                    {children}
                    {overlayConfig?.right && (
                        <Animated.View style={[styles.overlay, { backgroundColor: overlayConfig.right.color ?? 'transparent' }, rightOverlayStyle]}>
                            <Animated.View style={[rightIconStyle, { position: 'absolute', top: 20, left: 20 }]}>
                                {overlayConfig.right.icon}
                            </Animated.View>
                        </Animated.View>
                    )}
                    {overlayConfig?.left && (
                        <Animated.View style={[styles.overlay, { backgroundColor: overlayConfig.left.color ?? 'transparent' }, leftOverlayStyle]}>
                            <Animated.View style={[leftIconStyle, { position: 'absolute', top: 20, right: 20 }]}>
                                {overlayConfig.left.icon}
                            </Animated.View>
                        </Animated.View>
                    )}
                    {overlayConfig?.up && (
                        <Animated.View style={[styles.overlay, { backgroundColor: overlayConfig.up.color ?? 'transparent' }, upOverlayStyle]}>
                            <Animated.View style={[upIconStyle, { position: 'absolute', bottom: 20, alignSelf: 'center' }]}>
                                {overlayConfig.up.icon}
                            </Animated.View>
                        </Animated.View>
                    )}
                    {overlayConfig?.down && (
                        <Animated.View style={[styles.overlay, { backgroundColor: overlayConfig.down.color ?? 'transparent' }, downOverlayStyle]}>
                            <Animated.View style={[downIconStyle, { position: 'absolute', top: 20, alignSelf: 'center' }]}>
                                {overlayConfig.down.icon}
                            </Animated.View>
                        </Animated.View>
                    )}
                </Animated.View>
            </GestureDetector>
        </View>
    );
};
