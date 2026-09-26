import React, { useEffect, useMemo, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    cancelAnimation, Easing, Extrapolation, interpolate, runOnJS,
    useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { SwipeableCardContext } from './SwipeableCardContext';
import { useSwipeDeckContext } from './SwipeDeckContext';
import { finishCard, frontCard, swipeDirection } from './state';
import type { StackProgress } from './stack';
import { styles } from './styles/SwipeableWrapper.styles';
import type { SwipeDirection, SwipeOverlayConfig, SwipeStatus } from './types';

export interface SwipeableWrapperProps {
    children: React.ReactNode;
    status?: SwipeStatus;
    direction?: SwipeDirection;
    id: number;
    overlayConfig?: SwipeOverlayConfig;
    onCardPress?: () => void;
    progress: SharedValue<StackProgress>;
}

// Leaves native ad assets' taps intact until the finger actually drags.
const PAN_ACTIVATION_DISTANCE = 10;
const ICONMINOPACITY = 0.5;
const ICONMAXOPACITY = 0.8;

export const SwipeableWrapper: React.FC<SwipeableWrapperProps> = ({
    children, status = 'idle', direction, id, overlayConfig, onCardPress, progress,
}) => {
    const { state, requestSwipe } = useSwipeDeckContext();
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const threshold = screenWidth * 0.35;
    const maxOpacityWidth = screenWidth * 0.75;
    const maxOpacityHeight = screenHeight * 0.5;
    const rightMaxOpacity = overlayConfig?.right?.maxOpacity ?? 1;
    const leftMaxOpacity = overlayConfig?.left?.maxOpacity ?? 1;
    const upMaxOpacity = overlayConfig?.up?.maxOpacity ?? 1;
    const downMaxOpacity = overlayConfig?.down?.maxOpacity ?? 1;
    const [isTop, setIsTop] = useState(false);
    useAnimatedReaction(
        () => frontCard(state.value)?.id === id,
        (current, previous) => { if (current !== previous) runOnJS(setIsTop)(current); },
    );
    const cardState = useMemo(() => ({ isFront: isTop }), [isTop]);

    // Older history is prepared offscreen while the current undo animates.
    // The latest swiped card keeps its existing view, poster and exit position.
    const startsOffscreen = status === 'animating-in' || status === 'done-animating';
    const translateX = useSharedValue(startsOffscreen ? (direction === 'left' ? -screenWidth - 100 : direction === 'right' ? screenWidth + 100 : 0) : 0);
    const translateY = useSharedValue(startsOffscreen ? (direction === 'up' ? -screenHeight - 100 : direction === 'down' ? screenHeight + 100 : 0) : 0);
    const swipeableWidth = useSharedValue(0);
    const swipeableHeight = useSharedValue(0);
    const velocityX = useSharedValue(0);
    const velocityY = useSharedValue(0);
    const originX = useSharedValue(0);
    const originY = useSharedValue(0);
    const dragging = useSharedValue(false);

    // Each sample identifies both the card and its transition, so an earlier
    // swipe of the same card cannot supply the starting position of an undo.
    useAnimatedReaction(
        () => {
            const front = state.value.cards.find(card => card.status === 'idle' || card.status === 'animating-in');
            return { x: translateX.value, y: translateY.value, eligible: front?.id === id, transition: front?.transition ?? 0 };
        },
        current => {
            if (current.eligible) progress.value = { id, transition: current.transition, x: current.x, y: current.y };
            else if (dragging.value && state.value.cards.find(card => card.id === id)?.status === 'idle') {
                // Undo can take ownership while the next card is being dragged.
                dragging.value = false;
                translateX.value = withTiming(0, { duration: 220 });
                translateY.value = withTiming(0, { duration: 220 });
            }
        },
    );

    // Both gesture and button transitions animate here, entirely on the UI
    // thread. React renders and callback/network work cannot delay the exit.
    useAnimatedReaction(
        () => state.value.cards.find(card => card.id === id),
        (card, previous) => {
            if (!card || (card.transition === previous?.transition && card.status === previous?.status)) return;
            if (card.status !== 'animating-out' && card.status !== 'animating-in') return;
            cancelAnimation(translateX);
            cancelAnimation(translateY);
            const returning = card.status === 'animating-in';
            const horizontal = card.direction === 'left' || card.direction === 'right';
            const exitX = screenWidth / 2 + (swipeableWidth.value || screenWidth) / 2 + 100;
            const exitY = screenHeight / 2 + (swipeableHeight.value || screenHeight) / 2 + 100;
            const targetX = returning ? 0 : card.direction === 'left' ? -exitX : card.direction === 'right' ? exitX : translateX.value;
            const targetY = returning ? 0 : card.direction === 'up' ? -exitY : card.direction === 'down' ? exitY : translateY.value;
            const distance = Math.abs(horizontal ? targetX - translateX.value : targetY - translateY.value);
            const speed = Math.abs(horizontal ? velocityX.value : velocityY.value);
            const duration = returning || speed < 50 ? 300 : Math.max(100, Math.min(300, distance / speed * 1000));
            const config = { duration, easing: returning ? Easing.out(Easing.quad) : Easing.in(Easing.quad) };
            const transition = card.transition;
            // Completion rides the moving axis (timing to an unchanged value
            // completes immediately, even when a duration was supplied).
            translateX.value = withTiming(targetX, config, finished => {
                if (finished && horizontal) state.value = finishCard(state.value, id, transition);
            });
            translateY.value = withTiming(targetY, config, finished => {
                if (finished && !horizontal) state.value = finishCard(state.value, id, transition);
            });
        },
    );

    useEffect(() => () => {
        cancelAnimation(translateX);
        cancelAnimation(translateY);
    }, [translateX, translateY]);

    const panGesture = Gesture.Pan()
        .enabled(isTop)
        .minDistance(PAN_ACTIVATION_DISTANCE)
        .onStart(() => {
            if (frontCard(state.value)?.id !== id) return;
            cancelAnimation(translateX);
            cancelAnimation(translateY);
            originX.value = translateX.value;
            originY.value = translateY.value;
            dragging.value = true;
        })
        .onUpdate(event => {
            if (!dragging.value || frontCard(state.value)?.id !== id) return;
            translateX.value = originX.value + event.translationX;
            translateY.value = originY.value + event.translationY;
        })
        .onEnd((event, success) => {
            if (!success || !dragging.value || frontCard(state.value)?.id !== id) return;
            velocityX.value = event.velocityX;
            velocityY.value = event.velocityY;
            const nextDirection = swipeDirection(translateX.value, translateY.value, event.velocityX, event.velocityY, threshold);
            if (nextDirection) requestSwipe(id, nextDirection);
        })
        .onFinalize(() => {
            if (dragging.value && frontCard(state.value)?.id === id) {
                translateX.value = withTiming(0, { duration: 220 });
                translateY.value = withTiming(0, { duration: 220 });
            }
            dragging.value = false;
        });

    const tapGesture = Gesture.Tap()
        .enabled(isTop)
        .maxDistance(PAN_ACTIVATION_DISTANCE)
        .maxDuration(250)
        .onEnd((_event, success) => {
            if (success && !dragging.value && frontCard(state.value)?.id === id && onCardPress) runOnJS(onCardPress)();
        });
    const gesture = onCardPress ? Gesture.Exclusive(panGesture, tapGesture) : panGesture;

    const animatedStyle = useAnimatedStyle(() => ({
        // A parked history view must stay invisible even after screen rotation.
        // Read live state so undo reveals it without waiting for a React render.
        opacity: state.value.cards.some(card => card.id === id) ? 1 : 0,
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { rotateZ: `${interpolate(translateX.value, [-screenWidth, 0, screenWidth], [-15, 0, 15]) + interpolate(translateY.value, [-screenWidth, 0, screenWidth], [10, 0, -10])}deg` },
        ],
    }));

    const rightOverlayStyle = useAnimatedStyle(() => {
        const absX = Math.abs(translateX.value);
        const absY = Math.abs(translateY.value);
        if (absX < absY || translateX.value <= 0) return { opacity: 0 };
        const maxOpacity = rightMaxOpacity;
        return { opacity: interpolate(translateX.value, [0, maxOpacityWidth], [0, maxOpacity], Extrapolation.CLAMP) };
    });

    const leftOverlayStyle = useAnimatedStyle(() => {
        const absX = Math.abs(translateX.value);
        const absY = Math.abs(translateY.value);
        if (absX < absY || translateX.value >= 0) return { opacity: 0 };
        const maxOpacity = leftMaxOpacity;
        return { opacity: interpolate(-translateX.value, [0, maxOpacityWidth], [0, maxOpacity], Extrapolation.CLAMP) };
    });

    const upOverlayStyle = useAnimatedStyle(() => {
        const absX = Math.abs(translateX.value);
        const absY = Math.abs(translateY.value);
        if (absY <= absX || translateY.value >= 0) return { opacity: 0 };
        const maxOpacity = upMaxOpacity;
        return { opacity: interpolate(-translateY.value, [0, maxOpacityHeight], [0, maxOpacity], Extrapolation.CLAMP) };
    });

    const downOverlayStyle = useAnimatedStyle(() => {
        const absX = Math.abs(translateX.value);
        const absY = Math.abs(translateY.value);
        if (absY <= absX || translateY.value <= 0) return { opacity: 0 };
        const maxOpacity = downMaxOpacity;
        return { opacity: interpolate(translateY.value, [0, maxOpacityHeight], [0, maxOpacity], Extrapolation.CLAMP) };
    });

    const rightIconStyle = useAnimatedStyle(() => {
        const absX = Math.abs(translateX.value);
        const absY = Math.abs(translateY.value);
        const isHorizontalDominant = absX >= absY;
        const shouldSwipeRight = translateX.value > threshold;
        if (isHorizontalDominant && shouldSwipeRight) {
            return { opacity: interpolate(translateX.value, [threshold, screenWidth], [ICONMINOPACITY, ICONMAXOPACITY], Extrapolation.CLAMP) };
        }
        return { opacity: 0 };
    });

    const leftIconStyle = useAnimatedStyle(() => {
        const absX = Math.abs(translateX.value);
        const absY = Math.abs(translateY.value);
        const isHorizontalDominant = absX >= absY;
        const shouldSwipeLeft = translateX.value < -threshold;
        if (isHorizontalDominant && shouldSwipeLeft) {
            return { opacity: interpolate(-translateX.value, [threshold, screenWidth], [ICONMINOPACITY, ICONMAXOPACITY], Extrapolation.CLAMP) };
        }
        return { opacity: 0 };
    });

    const upIconStyle = useAnimatedStyle(() => {
        const absX = Math.abs(translateX.value);
        const absY = Math.abs(translateY.value);
        const isHorizontalDominant = absX >= absY;
        const shouldSwipeUp = translateY.value < -threshold;
        if (!isHorizontalDominant && shouldSwipeUp) {
            return { opacity: interpolate(-translateY.value, [threshold, screenWidth], [ICONMINOPACITY, ICONMAXOPACITY], Extrapolation.CLAMP) };
        }
        return { opacity: 0 };
    });

    const downIconStyle = useAnimatedStyle(() => {
        const absX = Math.abs(translateX.value);
        const absY = Math.abs(translateY.value);
        const isHorizontalDominant = absX >= absY;
        const shouldSwipeDown = translateY.value > threshold;
        if (!isHorizontalDominant && shouldSwipeDown) {
            return { opacity: interpolate(translateY.value, [threshold, screenWidth], [ICONMINOPACITY, ICONMAXOPACITY], Extrapolation.CLAMP) };
        }
        return { opacity: 0 };
    });


    return (
        <View
            pointerEvents={isTop ? 'auto' : 'none'}
            accessibilityElementsHidden={!isTop}
            importantForAccessibility={isTop ? 'auto' : 'no-hide-descendants'}
            style={styles.container}>
            <GestureDetector gesture={gesture}>
                <Animated.View
                    style={animatedStyle}
                    onLayout={(event) => {
                        swipeableWidth.value = event.nativeEvent.layout.width;
                        swipeableHeight.value = event.nativeEvent.layout.height;
                    }}
                >
                    <SwipeableCardContext.Provider value={cardState}>{children}</SwipeableCardContext.Provider>
                    {overlayConfig?.right && (
                        <Animated.View pointerEvents="none" style={[styles.overlay, { backgroundColor: overlayConfig.right.color ?? 'transparent' }, rightOverlayStyle]}>
                            <Animated.View style={[rightIconStyle, { position: 'absolute', top: 20, left: 20, alignItems: 'center' }, overlayConfig.right.iconContainerStyle]}>
                                {overlayConfig.right.icon}
                                {overlayConfig.right.label}
                            </Animated.View>
                        </Animated.View>
                    )}
                    {overlayConfig?.left && (
                        <Animated.View pointerEvents="none" style={[styles.overlay, { backgroundColor: overlayConfig.left.color ?? 'transparent' }, leftOverlayStyle]}>
                            <Animated.View style={[leftIconStyle, { position: 'absolute', top: 20, right: 20, alignItems: 'center' }, overlayConfig.left.iconContainerStyle]}>
                                {overlayConfig.left.icon}
                                {overlayConfig.left.label}
                            </Animated.View>
                        </Animated.View>
                    )}
                    {overlayConfig?.up && (
                        <Animated.View pointerEvents="none" style={[styles.overlay, { backgroundColor: overlayConfig.up.color ?? 'transparent' }, upOverlayStyle]}>
                            <Animated.View style={[upIconStyle, { position: 'absolute', bottom: 20, alignSelf: 'center', alignItems: 'center' }, overlayConfig.up.iconContainerStyle]}>
                                {overlayConfig.up.icon}
                                {overlayConfig.up.label}
                            </Animated.View>
                        </Animated.View>
                    )}
                    {overlayConfig?.down && (
                        <Animated.View pointerEvents="none" style={[styles.overlay, { backgroundColor: overlayConfig.down.color ?? 'transparent' }, downOverlayStyle]}>
                            <Animated.View style={[downIconStyle, { position: 'absolute', top: 20, alignSelf: 'center', alignItems: 'center' }, overlayConfig.down.iconContainerStyle]}>
                                {overlayConfig.down.icon}
                                {overlayConfig.down.label}
                            </Animated.View>
                        </Animated.View>
                    )}
                </Animated.View>
            </GestureDetector>
        </View>
    );
};
