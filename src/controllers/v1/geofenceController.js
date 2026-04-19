/**
 * v1 Geofence Controller
 *
 * POST /api/v1/geofences            — create
 * GET  /api/v1/geofences?office_id= — list
 * PUT  /api/v1/geofences/:id        — update
 * POST /api/v1/geofences/validate   — check if point is inside
 */

const { v4: uuidv4 } = require('uuid');
const store  = require('../../db/store');
const { TABLES } = store;
const { asyncHandler, ok, fail } = require('../../utils/helpers');

const listGeofences = asyncHandler(async (req, res) => {
  const { office_id } = req.query;
  let geos = await store.getAll(TABLES.GEOFENCES);
  if (office_id) geos = geos.filter(g => String(g.office_id) === String(office_id));
  return ok(res, geos);
});

const createGeofence = asyncHandler(async (req, res) => {
  const { office_id, geofence_name, latitude, longitude, radius_m } = req.body;
  if (!office_id || latitude == null || longitude == null || !radius_m)
    return fail(res, 'office_id, latitude, longitude, radius_m are required');

  const geo = await store.insert(TABLES.GEOFENCES, {
    geofence_id:   uuidv4(),
    office_id,
    geofence_name: geofence_name || 'Office Perimeter',
    latitude:      parseFloat(latitude),
    longitude:     parseFloat(longitude),
    radius_m:      parseFloat(radius_m),
    is_active:     true,
    created_at:    new Date().toISOString(),
  });

  return ok(res, geo, 'Geofence created', 201);
});

const updateGeofence = asyncHandler(async (req, res) => {
  const geo = await store.getById(TABLES.GEOFENCES, 'geofence_id', req.params.id);
  if (!geo) return fail(res, 'Geofence not found', 404);
  const updated = await store.update(TABLES.GEOFENCES, 'geofence_id', req.params.id, req.body);
  return ok(res, updated);
});

// POST /api/v1/geofences/validate
const validateGeofence = asyncHandler(async (req, res) => {
  const { office_id, latitude, longitude } = req.body;
  if (!office_id || latitude == null || longitude == null)
    return fail(res, 'office_id, latitude, longitude are required');

  const geos = await store.findMany(TABLES.GEOFENCES,
    g => String(g.office_id) === String(office_id) && g.is_active);

  if (!geos.length) return fail(res, 'No active geofence found for this office', 404);

  // Check all geofences and return the closest / first match
  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);

  let inside = false;
  let closestGeo = null;
  let closestDist = Infinity;

  for (const geo of geos) {
    const dist = haversineMeters(lat, lon, geo.latitude, geo.longitude);
    if (dist < closestDist) {
      closestDist = dist;
      closestGeo  = geo;
      inside      = dist <= geo.radius_m;
    }
  }

  return ok(res, {
    inside,
    distance_m:    Math.round(closestDist * 10) / 10,
    geofence_name: closestGeo.geofence_name,
    geofence_id:   closestGeo.geofence_id,
    radius_m:      closestGeo.radius_m,
  });
});

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6_371_000;
  const p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180, dl = (lon2 - lon1) * Math.PI / 180;
  const a  = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = { listGeofences, createGeofence, updateGeofence, validateGeofence };
