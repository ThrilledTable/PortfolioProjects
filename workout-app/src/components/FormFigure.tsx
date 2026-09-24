import React from 'react';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { colors } from '../theme/theme';

export interface Point {
  x: number;
  y: number;
}

export type BoneKey = 'spine' | 'upperArm' | 'forearm' | 'thigh' | 'shin';

export interface Pose {
  head: Point;
  neck: Point;
  shoulder: Point;
  elbow: Point;
  wrist: Point;
  hip: Point;
  knee: Point;
  ankle: Point;
  toe?: Point;
  highlight: BoneKey[];
  motionPath?: string;
  motionEnd?: Point;
  secondaryLeg?: { hip: Point; knee: Point; ankle: Point };
}

const MUTED = colors.textMuted;
const ACCENT = colors.accent;
const BASE_WIDTH = 4;
const HIGHLIGHT_WIDTH = 5.5;

export default function FormFigure({ pose, size = 96 }: { pose: Pose; size?: number }) {
  const bone = (key: BoneKey, a: Point, b: Point) => {
    const isHighlight = pose.highlight.includes(key);
    return (
      <Line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={isHighlight ? ACCENT : MUTED}
        strokeWidth={isHighlight ? HIGHLIGHT_WIDTH : BASE_WIDTH}
        strokeLinecap="round"
      />
    );
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      {pose.secondaryLeg && (
        <>
          <Line
            x1={pose.hip.x}
            y1={pose.hip.y}
            x2={pose.secondaryLeg.knee.x}
            y2={pose.secondaryLeg.knee.y}
            stroke={colors.border}
            strokeWidth={BASE_WIDTH}
            strokeLinecap="round"
            strokeDasharray="2,4"
          />
          <Line
            x1={pose.secondaryLeg.knee.x}
            y1={pose.secondaryLeg.knee.y}
            x2={pose.secondaryLeg.ankle.x}
            y2={pose.secondaryLeg.ankle.y}
            stroke={colors.border}
            strokeWidth={BASE_WIDTH}
            strokeLinecap="round"
            strokeDasharray="2,4"
          />
        </>
      )}

      {bone('spine', pose.neck, pose.hip)}
      {bone('thigh', pose.hip, pose.knee)}
      {bone('shin', pose.knee, pose.ankle)}
      {pose.toe && (
        <Line
          x1={pose.ankle.x}
          y1={pose.ankle.y}
          x2={pose.toe.x}
          y2={pose.toe.y}
          stroke={pose.highlight.includes('shin') ? ACCENT : MUTED}
          strokeWidth={BASE_WIDTH}
          strokeLinecap="round"
        />
      )}
      {bone('upperArm', pose.shoulder, pose.elbow)}
      {bone('forearm', pose.elbow, pose.wrist)}

      <Circle cx={pose.head.x} cy={pose.head.y} r={7} fill="none" stroke={MUTED} strokeWidth={4} />

      {pose.motionPath && (
        <Path
          d={pose.motionPath}
          fill="none"
          stroke={ACCENT}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray="1,5"
          opacity={0.9}
        />
      )}
      {pose.motionEnd && <Circle cx={pose.motionEnd.x} cy={pose.motionEnd.y} r={3} fill={ACCENT} />}
    </Svg>
  );
}
