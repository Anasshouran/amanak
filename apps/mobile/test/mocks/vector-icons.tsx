/** Test-only mock for `@expo/vector-icons` (its compiled `createIconSet.js` is
 * absent in this environment, so the real package cannot load under vitest).
 * Icons render as their name text — sufficient for component interaction tests.
 */
import { forwardRef } from "react"
import { Text } from "react-native"

export const Ionicons = forwardRef(
  (_props: any, _ref: any) => (
    <Text style={{ fontSize: (_props as any).size ?? 16, color: (_props as any).color }}>
      {(_props as any).children ?? String((_props as any).name)}
    </Text>
  ),
)

export const AntDesign = Ionicons
export const Entypo = Ionicons
export const EvilIcons = Ionicons
export const Feather = Ionicons
export const FontAwesome = Ionicons
export const FontAwesome5 = Ionicons
export const FontAwesome6 = Ionicons
export const Foundation = Ionicons
export const MaterialCommunityIcons = Ionicons
export const MaterialIcons = Ionicons
export const SimpleLineIcons = Ionicons
export const Zocial = Ionicons

export default Ionicons
