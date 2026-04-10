import React, { useEffect } from 'react';
import { Dimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
import { styles } from './styles/SwipeableWrapper.styles';
import { SwipeDirection, SwipeStatus } from './types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface SwipeableWrapperProps {
    children: React.ReactNode;
    status?: SwipeStatus;
    direction?: SwipeDirection;
    isTopSwipeable: boolean;
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
    onAnimationOutComplete?: () => void;
    onAnimationInComplete?: () => void;
}

const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.35;
const VELOCITY_THRESHOLD = 800;

export const SwipeableWrapper: React.FC<SwipeableWrapperProps> = ({
    children,
    status = 'idle',
    direction,
    isTopSwipeable,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onAnimationOutComplete,
    onAnimationInComplete
}) => {
    // Initialize positions based on status to prevent the (0,0) flash on mount
    const getInitialX = () => {
        if (status !== 'animating-in') return 0;
        if (direction === 'left') return -SCREEN_WIDTH;
        if (direction === 'right') return SCREEN_WIDTH;
        return 0;
    };

    const getInitialY = () => {
        if (status !== 'animating-in') return 0;
        if (direction === 'up') return -SCREEN_HEIGHT;
        if (direction === 'down') return SCREEN_HEIGHT;
        return 0;
    };

    const translateX = useSharedValue(getInitialX());
    const translateY = useSharedValue(getInitialY());

    // Using SharedValues for these allows the UI thread to access the
    // measurements instantly for animations without waiting for React re-renders.
    const swipeableWidth = useSharedValue(0);
    const swipeableHeight = useSharedValue(0);

    // Store velocities onEnd for use in the animation effect
    const velocityX = useSharedValue(0);
    const velocityY = useSharedValue(0);

    const gesture = Gesture.Pan()
        .enabled(isTopSwipeable)
        .onUpdate((event) => {
            translateX.value = event.translationX;
            translateY.value = event.translationY;
        })
        .onEnd((event) => {
            velocityX.value = event.velocityX;
            velocityY.value = event.velocityY;

            const shouldSwipeRight = translateX.value > SWIPE_THRESHOLD || (event.velocityX > VELOCITY_THRESHOLD && translateX.value > 0);
            const shouldSwipeLeft = translateX.value < -SWIPE_THRESHOLD || (event.velocityX < -VELOCITY_THRESHOLD && translateX.value < 0);
            const shouldSwipeUp = translateY.value < -SWIPE_THRESHOLD || (event.velocityY < -VELOCITY_THRESHOLD && translateY.value < 0);
            const shouldSwipeDown = translateY.value > SWIPE_THRESHOLD || (event.velocityY > VELOCITY_THRESHOLD && translateY.value > 0);

            const absX = Math.abs(translateX.value);
            const absY = Math.abs(translateY.value);
            const isHorizontalDominant = absX > absY;

            if (isHorizontalDominant && shouldSwipeRight) {
                if (onSwipeRight) runOnJS(onSwipeRight)();
            } else if (isHorizontalDominant && shouldSwipeLeft) {
                if (onSwipeLeft) runOnJS(onSwipeLeft)();
            } else if (!isHorizontalDominant && shouldSwipeUp) {
                if (onSwipeUp) runOnJS(onSwipeUp)();
            } else if (!isHorizontalDominant && shouldSwipeDown) {
                if (onSwipeDown) runOnJS(onSwipeDown)();
            } else {
                translateX.value = withTiming(0, { duration: 300 });
                translateY.value = withTiming(0, { duration: 300 });
            }
        });


    // ----------------------------- SWIPE ANIMATION -----------------------------

    const calculateDuration = (target: number, translate: number, velocity: number) => {
        let duration = 300;
        const absDistance = Math.abs(target - translate);
        const absVelocity = Math.abs(velocity);
        if (absVelocity > 50) {
            duration = Math.min(300, Math.max(100, (absDistance / absVelocity) * 1000));
        }
        return duration;
    }

    useEffect(() => {
        // Calculate exact exit/start targets based on measured size
        // Fallback to constants if onLayout hasn't fired yet (common on mount)
        const currentWidth = swipeableWidth.value || SCREEN_WIDTH;
        const currentHeight = swipeableHeight.value || SCREEN_HEIGHT;
        const horizontalExit = (SCREEN_WIDTH / 2) + (currentWidth / 2) + 100;
        const verticalExit = (SCREEN_HEIGHT / 2) + (currentHeight / 2) + 100;

        if (status === 'animating-out') {

            let targetX: number;
            let targetY: number;

            switch (direction) {
                case 'left': targetX = -horizontalExit; targetY = 0; break;
                case 'right': targetX = horizontalExit; targetY = 0; break;
                case 'up': targetX = 0; targetY = -verticalExit; break;
                case 'down': targetX = 0; targetY = verticalExit; break;
                default: throw new Error(`Swipeable: direction must be provided when animating. Current: ${direction}`);
            }

            let duration = 300;

            if (direction === 'left' || direction === 'right') {
                duration = calculateDuration(targetX, translateX.value, velocityX.value);

                translateY.value = withTiming(targetY, { duration, easing: Easing.in(Easing.quad) });
                translateX.value = withTiming(targetX, { duration, easing: Easing.in(Easing.quad) }, (finished) => {
                    if (finished && onAnimationOutComplete) {
                        runOnJS(onAnimationOutComplete)();
                    }
                });

            } else if (direction === 'up' || direction === 'down') {
                duration = calculateDuration(targetY, translateY.value, velocityY.value);

                translateX.value = withTiming(targetX, { duration, easing: Easing.in(Easing.quad) });
                translateY.value = withTiming(targetY, { duration, easing: Easing.in(Easing.quad) }, (finished) => {
                    if (finished && onAnimationOutComplete) {
                        runOnJS(onAnimationOutComplete)();
                    }
                });
            }
        } else if (status === 'animating-in') {

            // Animate back to center
            translateX.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) });
            translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) }, (finished) => {
                if (finished && onAnimationInComplete) {
                    runOnJS(onAnimationInComplete)();
                }
            });
        } else if (status === 'idle') {
            translateX.value = withTiming(0, { duration: 300 });
            translateY.value = withTiming(0, { duration: 300 });
        }
    }, [status, direction, onAnimationOutComplete, onAnimationInComplete]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { rotate: `${translateX.value / 25}deg` },
        ],
    }));

    return (
        <View
            pointerEvents={(status === 'animating-out' || status === 'animating-in') ? 'none' : 'auto'}
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
                </Animated.View>
            </GestureDetector>
        </View>
    );
};
