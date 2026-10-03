import type { LucideIcon } from "lucide-react"
import {
  Backpack,
  Bike,
  Bird,
  Bus,
  Car,
  Cat,
  CloudFog,
  Crosshair,
  Dog,
  Flame,
  Footprints,
  Laptop,
  Monitor,
  Package,
  PersonStanding,
  Ship,
  ShieldAlert,
  Smartphone,
  Swords,
  Truck,
  User,
  Users,
} from "lucide-react"

/** Map YOLO / detection class names to a matching Lucide icon. */
export function iconForDetectionClass(className: string): LucideIcon {
  const cls = (className || "").toLowerCase().trim()

  if (
    cls.includes("weapon") ||
    cls.includes("gun") ||
    cls.includes("pistol") ||
    cls.includes("rifle") ||
    cls.includes("knife") ||
    cls.includes("blade")
  ) {
    return Swords
  }
  if (cls.includes("fire") || cls.includes("flame") || cls.includes("blaze")) return Flame
  if (cls.includes("smoke")) return CloudFog
  if (cls.includes("crowd") || cls.includes("people")) return Users
  if (cls === "person" || cls.includes("pedestrian") || cls.includes("human")) return PersonStanding
  if (cls.includes("face") || cls.includes("staff") || cls.includes("officer")) return User

  if (cls.includes("motorcycle") || cls.includes("motorbike") || cls.includes("scooter")) return Bike
  if (cls.includes("bicycle") || cls.includes("bike") || cls.includes("cycle")) return Bike
  if (cls.includes("truck") || cls.includes("lorry")) return Truck
  if (cls.includes("bus") || cls.includes("coach")) return Bus
  if (
    cls.includes("car") ||
    cls.includes("vehicle") ||
    cls.includes("van") ||
    cls.includes("suv") ||
    cls.includes("auto")
  ) {
    return Car
  }
  if (cls.includes("boat") || cls.includes("ship") || cls.includes("vessel")) return Ship

  if (cls.includes("laptop") || cls.includes("notebook")) return Laptop
  if (cls.includes("monitor") || cls.includes("tv") || cls.includes("screen")) return Monitor
  if (cls.includes("phone") || cls.includes("mobile") || cls.includes("cell")) return Smartphone
  if (cls.includes("backpack") || cls.includes("bag") || cls.includes("handbag")) return Backpack
  if (cls.includes("suitcase") || cls.includes("luggage") || cls.includes("package") || cls.includes("box")) {
    return Package
  }

  if (cls.includes("dog")) return Dog
  if (cls.includes("cat")) return Cat
  if (cls.includes("bird")) return Bird
  if (cls.includes("animal")) return Footprints

  if (cls.includes("intrusion") || cls.includes("trespass") || cls.includes("suspicious")) {
    return ShieldAlert
  }

  return Crosshair
}

export function detectionIconTone(className: string, isAlert: boolean): string {
  const cls = (className || "").toLowerCase()
  if (
    cls.includes("weapon") ||
    cls.includes("gun") ||
    cls.includes("fire") ||
    cls.includes("flame") ||
    cls === "crowd"
  ) {
    return "text-red-400"
  }
  if (isAlert) return "text-amber-400"
  if (cls.includes("person") || cls.includes("face") || cls.includes("human")) return "text-sky-300"
  if (
    cls.includes("car") ||
    cls.includes("truck") ||
    cls.includes("bus") ||
    cls.includes("motor") ||
    cls.includes("vehicle") ||
    cls.includes("bike")
  ) {
    return "text-emerald-300"
  }
  return "text-zinc-300"
}
