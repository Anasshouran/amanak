import * as Notifications from "expo-notifications"
import * as Device from "expo-device"
import { Platform } from "react-native"
import { api } from "./api"

export async function registerForPush(): Promise<string | null> {
  if (Platform.OS === "web") return null
  if (!Device.isDevice) return null

  try {
    const { status: existing } = await Notifications.getPermissionsAsync()
    let status = existing
    if (status !== "granted") {
      const { status: requested } = await Notifications.requestPermissionsAsync()
      status = requested
    }
    if (status !== "granted") return null

    const tokenData = await Notifications.getExpoPushTokenAsync()
    const token = tokenData.data
    if (!token) return null

    await api.registerPushToken({ token, platform: Platform.OS })

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: true,
      }),
    })

    return token
  } catch {
    return null
  }
}

export function setupNotificationTapHandler(navigate: (path: string) => void) {
  try {
    Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = (response?.notification?.request?.content?.data ?? {}) as Record<string, any>
      if (data.type === "breach") navigate("/breach")
      else if (data.type === "family") navigate("/family")
      else if (data.type === "session") navigate("/security")
    })
  } catch {
    /* ignore */
  }
}
