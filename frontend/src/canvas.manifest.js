export const manifest = {
  screens: {
    scr_du5kum: { name: "Onboarding", route: "/onboarding", position: { "x": 160, "y": 220 } },
    scr_nzuu63: { name: "Dashboard", route: "/", position: { "x": 160, "y": 2200 } },
    scr_0lg5ho: { name: "Alert Trigger", route: "/alert", position: { "x": 160, "y": 4180 } },
    scr_iqua0h: { name: "Camera Gesture", route: "/gesture", position: { "x": 1560, "y": 4180 } },
    scr_qouwnu: { name: "Evidence", route: "/evidence", position: { "x": 160, "y": 6160 } },
    scr_rn35fn: { name: "Contacts", route: "/contacts", position: { "x": 1560, "y": 6160 } },
    scr_f9hlwz: { name: "History", route: "/history", position: { "x": 2960, "y": 6160 } },
    scr_cqxxzq: { name: "Settings", route: "/settings", position: { "x": 160, "y": 8140 } }
  },
  sections: {
    sec_vammpi: { name: "Onboarding", x: 0, y: 0, width: 1520, height: 1180 },
    sec_6ti8sy: { name: "Main app", x: 0, y: 1980, width: 1520, height: 1180 },
    sec_j55b52: { name: "Core features", x: 0, y: 3960, width: 2920, height: 1180 },
    sec_dg6tdv: { name: "Data management", x: 0, y: 5940, width: 4320, height: 1180 },
    sec_3ft2t1: { name: "Settings", x: 0, y: 7920, width: 1520, height: 1180 }
  },
  layers: [
  { kind: "section", id: "sec_vammpi", children: [
    { kind: "screen", id: "scr_du5kum" }]
  },
  { kind: "section", id: "sec_6ti8sy", children: [
    { kind: "screen", id: "scr_nzuu63" }]
  },
  { kind: "section", id: "sec_j55b52", children: [
    { kind: "screen", id: "scr_0lg5ho" },
    { kind: "screen", id: "scr_iqua0h" }]
  },
  { kind: "section", id: "sec_dg6tdv", children: [
    { kind: "screen", id: "scr_qouwnu" },
    { kind: "screen", id: "scr_rn35fn" },
    { kind: "screen", id: "scr_f9hlwz" }]
  },
  { kind: "section", id: "sec_3ft2t1", children: [
    { kind: "screen", id: "scr_cqxxzq" }]
  }]

};