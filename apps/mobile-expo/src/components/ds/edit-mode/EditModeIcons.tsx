import Svg, { Circle, Path, Rect } from 'react-native-svg';

const S = 2;
const EDIT_ICON_SIZE = 20;
/** Lucide paths use a 24px grid; scale stroke so it matches S on the 20px edit slot. */
const S_LUCIDE = S * (24 / EDIT_ICON_SIZE);

type IconProps = { color: string; size?: number };

/** Person — matches Calendar guest row. */
export function EditIconPerson({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Circle cx={10} cy={7} r={3} stroke={color} strokeWidth={S} />
      <Path
        d="M4 17c0-3.314 2.686-5 6-5s6 1.686 6 5"
        stroke={color}
        strokeWidth={S}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Phone handset — Lucide `phone`, uniformly scaled into the 20px edit slot. */
export function EditIconPhone({ color, size = EDIT_ICON_SIZE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
        stroke={color}
        strokeWidth={S_LUCIDE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Envelope — Lucide `mail`, uniformly scaled into the 20px edit slot. */
export function EditIconEmail({ color, size = EDIT_ICON_SIZE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x={2}
        y={4}
        width={20}
        height={16}
        rx={2}
        stroke={color}
        strokeWidth={S_LUCIDE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"
        stroke={color}
        strokeWidth={S_LUCIDE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Map pin — matches Calendar location row. */
export function EditIconLocation({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path
        d="M10 17.5s5.5-4.03 5.5-8.75a5.5 5.5 0 1 0-11 0C4.5 13.47 10 17.5 10 17.5Z"
        stroke={color}
        strokeWidth={S}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={10} cy={8.75} r={1.75} stroke={color} strokeWidth={S} />
    </Svg>
  );
}

/** User in rounded square — Lucide `square-user-round`, for device contacts import. */
export function EditIconContactBook({ color, size = EDIT_ICON_SIZE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 21a6 6 0 0 0-12 0"
        stroke={color}
        strokeWidth={S_LUCIDE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle
        cx={12}
        cy={11}
        r={4}
        stroke={color}
        strokeWidth={S_LUCIDE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Rect
        x={3}
        y={3}
        width={18}
        height={18}
        rx={2}
        stroke={color}
        strokeWidth={S_LUCIDE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Link / attach — session picker affordance. */
export function EditIconLink({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path
        d="M8.5 11.5a3.5 3.5 0 0 0 5 0l2-2a3.5 3.5 0 0 0-5-5l-1 1M11.5 8.5a3.5 3.5 0 0 0-5 0l-2 2a3.5 3.5 0 0 0 5 5l1-1"
        stroke={color}
        strokeWidth={S}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
