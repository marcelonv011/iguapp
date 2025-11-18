import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';

// Firebase
import { db, auth } from '@/firebase';
import {
  collection,
  getDocs,
  query,
  doc,
  runTransaction,
  serverTimestamp,
  orderBy,
  where,
  addDoc,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

// UI & iconos
import {
  UtensilsCrossed,
  Search,
  Star,
  Clock,
  DollarSign,
  Filter,
  MapPin,
  Flag,
} from 'lucide-react';
import { Card, CardContent } from '@/ui/card';
import { Input } from '@/ui/input';
import { Badge } from '@/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/dialog';
import { Textarea } from '@/ui/textarea';

export default function Delivery() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [restaurants, setRestaurants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [user, setUser] = useState(null);
  const [userRatings, setUserRatings] = useState({}); // { [restaurantId]: number }
  const [cityFilter, setCityFilter] = useState('all');

  // ==== Reportes ====
  const [reportRestaurant, setReportRestaurant] = useState(null);
  const [reportComment, setReportComment] = useState('');
  const [reportLoading, setReportLoading] = useState(false);

  // ==== Auth: saber si hay usuario logueado ====
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u || null);
      if (!u) {
        setUserRatings({});
        return;
      }

      // cargar calificaciones previas del usuario para restaurantes
      try {
        const snap = await getDocs(
          collection(db, 'users', u.uid, 'restaurant_ratings')
        );
        const map = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          if (typeof data.value === 'number') {
            map[d.id] = data.value;
          }
        });
        setUserRatings(map);
      } catch (e) {
        console.error('Error cargando ratings de restaurantes:', e);
      }
    });

    return () => unsub();
  }, []);

  // ==== Cargar restaurantes desde Firestore ====
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const ref = collection(db, 'restaurants');
        const q = query(
          ref,
          where('status', '==', 'approved'), // 👈 solo aprobados
          orderBy('rating', 'desc')
        );
        const snapshot = await getDocs(q);

        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // ➜ Filtrar por suscripción activa del dueño del restaurante
        const filtered = await filterRestaurantsBySubscription(data);

        setRestaurants(filtered);
      } catch (error) {
        console.error('Error al cargar restaurantes:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRestaurants();
  }, []);

  // ---- Helpers de fecha/suscripción ----
  const toJsDate = (v) => {
    if (!v) return null;
    if (v?.toDate) return v.toDate();
    if (v?.seconds) return new Date(v.seconds * 1000);
    const d = new Date(v);
    return isNaN(d) ? null : d;
  };

  const isExpired = (end) => {
    const d = toJsDate(end);
    return d ? d.getTime() < Date.now() : true;
  };

  // Filtra restaurantes cuyo dueño NO tiene suscripción activa
  async function filterRestaurantsBySubscription(list) {
    if (!list.length) return [];

    // extraer todos los emails de los dueños (owner_email primero)
    const emails = [
      ...new Set(
        list
          .map((r) => (r.owner_email || r.created_by || '').trim())
          .filter(Boolean)
      ),
    ];

    if (!emails.length) return [];

    const states = {}; // { email: { sub, expired } }

    await Promise.all(
      emails.map(async (email) => {
        try {
          const qSub = query(
            collection(db, 'subscriptions'),
            where('user_email', '==', email)
          );
          const snap = await getDocs(qSub);
          if (snap.empty) return;

          const docs = snap.docs.map((d) => d.data());

          // elegir la suscripción con mayor end_date
          const pickBest = (arr) =>
            arr.reduce((best, cur) => {
              if (!cur.end_date) return best;
              if (!best || !best.end_date) return cur;

              const ms = cur.end_date?.toDate?.()
                ? cur.end_date.toDate().getTime()
                : cur.end_date?.seconds
                ? cur.end_date.seconds * 1000
                : new Date(cur.end_date).getTime();

              const bestMs = best.end_date?.toDate?.()
                ? best.end_date.toDate().getTime()
                : best.end_date?.seconds
                ? best.end_date.seconds * 1000
                : new Date(best.end_date).getTime();

              return ms > bestMs ? cur : best;
            }, null);

          const sub = pickBest(docs);
          if (!sub) return;

          states[email] = {
            sub,
            expired: isExpired(sub.end_date),
          };
        } catch (e) {
          console.error('Error en sub de', email, e);
        }
      })
    );

    // filtrar restaurantes
    return list.filter((r) => {
      // 👇 usamos la MISMA clave que para armar "states"
      const key = (r.owner_email || r.created_by || '').trim();
      const info = states[key];
      if (!info) return false;
      if (info.sub.status !== 'active') return false;
      if (info.expired) return false;
      return true;
    });
  }

  // ==== Handler para votar restaurante ====
  const handleRate = async (restaurant, value) => {
    if (!user) {
      toast.error('Iniciá sesión para calificar el restaurante');
      return;
    }
    if (value < 1 || value > 5) return;

    const restId = restaurant.id;
    const restRef = doc(db, 'restaurants', restId);
    const userRatingRef = doc(
      db,
      'users',
      user.uid,
      'restaurant_ratings',
      restId
    );

    try {
      await runTransaction(db, async (tx) => {
        const restSnap = await tx.get(restRef);
        if (!restSnap.exists()) {
          throw new Error('Restaurante no encontrado');
        }
        const data = restSnap.data();

        const userRatingSnap = await tx.get(userRatingRef);
        const prevVal = userRatingSnap.exists()
          ? userRatingSnap.data().value
          : null;

        let count = data.rating_count || 0;
        let sum = data.rating_sum || 0;

        if (prevVal == null) {
          // voto nuevo
          count += 1;
          sum += value;
        } else {
          // actualización de voto anterior
          sum = sum - prevVal + value;
        }

        const avg = count > 0 ? sum / count : 0;

        tx.update(restRef, {
          rating_count: count,
          rating_sum: sum,
          rating: avg,
        });

        tx.set(userRatingRef, {
          value,
          restaurant_id: restId,
          updated_at: serverTimestamp(),
        });

        // actualizar estado local para reflejar al toque
        setRestaurants((prev) =>
          prev.map((r) =>
            r.id === restId
              ? {
                  ...r,
                  rating_count: count,
                  rating_sum: sum,
                  rating: avg,
                }
              : r
          )
        );
      });

      setUserRatings((prev) => ({ ...prev, [restId]: value }));
      toast.success(`Calificación enviada: ${value}★`);
    } catch (e) {
      console.error(e);
      toast.error('No se pudo guardar tu voto');
    }
  };

  // ==== Reportes: abrir modal ====
  const openReportModal = (restaurant) => {
    if (!user) {
      toast.error('Tenés que iniciar sesión para reportar un restaurante');
      return;
    }
    setReportRestaurant(restaurant);
    setReportComment('');
  };

  // ==== Enviar reporte ====
  const submitReport = async () => {
    if (!reportRestaurant || !reportComment.trim()) {
      toast.error('Escribí un comentario antes de enviar.');
      return;
    }

    try {
      setReportLoading(true);

      await addDoc(collection(db, 'reports'), {
        publication_id: reportRestaurant.id,
        publication_title: reportRestaurant.name || '',
        owner_email:
          reportRestaurant.owner_email || reportRestaurant.created_by || null,
        reporter_uid: user.uid,
        reporter_email: user.email,
        comment: reportComment.trim(),
        category: 'restaurant', // o "delivery", como prefieras distinguir
        status: 'open',
        created_at: serverTimestamp(),
      });

      toast.success('Reporte enviado. Gracias por avisar 🙌');
      setReportRestaurant(null);
      setReportComment('');
    } catch (err) {
      console.error(err);
      toast.error('No se pudo enviar el reporte.');
    } finally {
      setReportLoading(false);
    }
  };

  // ==== Filtros de búsqueda y categoría ====
  const filteredRestaurants = useMemo(() => {
    return restaurants.filter((restaurant) => {
      const name = (restaurant.name || '').toLowerCase();
      const description = (restaurant.description || '').toLowerCase();
      const search = searchTerm.toLowerCase();

      const matchesSearch =
        name.includes(search) || description.includes(search);

      const matchesCategory =
        categoryFilter === 'all' || restaurant.category === categoryFilter;

      const city = (restaurant.city || '').trim();
      const matchesCity = cityFilter === 'all' || city === cityFilter;

      return matchesSearch && matchesCategory && matchesCity;
    });
  }, [restaurants, searchTerm, categoryFilter, cityFilter]);

  const categories = [
    { value: 'pizza', label: 'Pizza' },
    { value: 'hamburguesa', label: 'Hamburguesa' },
    { value: 'empanadas', label: 'Empanadas' },
    { value: 'sushi', label: 'Sushi' },
    { value: 'parrilla', label: 'Parrilla' },
    { value: 'comida_rapida', label: 'Comida Rápida' },
    { value: 'saludable', label: 'Saludable' },
    { value: 'postres', label: 'Postres' },
    { value: 'otro', label: 'Otro' },
  ];

  const cities = useMemo(() => {
    const set = new Set();
    restaurants.forEach((r) => {
      const city = (r.city || '').trim();
      if (city) set.add(city);
    });
    return Array.from(set).sort();
  }, [restaurants]);

  return (
    <div className='min-h-screen bg-gradient-to-br from-red-50 to-slate-100 py-8'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        {/* Header */}
        <div className='mb-8'>
          <div className='flex items-center gap-3 mb-4'>
            <div className='w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center'>
              <UtensilsCrossed className='w-6 h-6 text-white' />
            </div>
            <div>
              <h1 className='text-3xl md:text-4xl font-bold text-slate-900'>
                Delivery
              </h1>
              <p className='text-slate-600'>
                Pedí comida de tus restaurantes favoritos
              </p>
            </div>
          </div>

          {/* Filtros */}
          <div className='bg-white rounded-xl shadow-lg p-6'>
            <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
              <div className='md:col-span-2'>
                <div className='relative'>
                  <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5' />
                  <Input
                    placeholder='Buscar restaurantes o comida...'
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className='pl-10'
                  />
                </div>
              </div>

              {/* Filtro por categoría */}
              <Select
                value={categoryFilter}
                onValueChange={(value) => setCategoryFilter(value)}
              >
                <SelectTrigger>
                  <Filter className='w-4 h-4 mr-2' />
                  <SelectValue placeholder='Categoría' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Todas las categorías</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Filtro por ciudad */}
              <Select
                value={cityFilter}
                onValueChange={(value) => setCityFilter(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder='Ciudad' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Todas las ciudades</SelectItem>
                  {cities.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Resultados */}
        <div className='mb-6'>
          <p className='text-slate-600'>
            {filteredRestaurants.length}{' '}
            {filteredRestaurants.length === 1
              ? 'restaurante disponible'
              : 'restaurantes disponibles'}
          </p>
        </div>

        {isLoading ? (
          // Skeleton mientras carga
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className='animate-pulse'>
                <div className='h-48 bg-slate-200' />
                <CardContent className='p-6'>
                  <div className='h-6 bg-slate-200 rounded mb-4' />
                  <div className='h-4 bg-slate-200 rounded mb-2' />
                  <div className='h-4 bg-slate-200 rounded w-2/3' />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {filteredRestaurants.map((restaurant) => {
              // === LÓGICA DE RATING COMO EN EMPRENDIMIENTOS ===
              const ratingCount =
                typeof restaurant.rating_count === 'number'
                  ? restaurant.rating_count
                  : 0;
              const hasVotes = ratingCount > 0;

              const avgRating =
                hasVotes &&
                typeof restaurant.rating === 'number' &&
                !isNaN(restaurant.rating)
                  ? restaurant.rating
                  : 0;

              const roundedAvg = hasVotes ? Math.round(avgRating) : 0;
              const userRating = userRatings[restaurant.id] || null;

              return (
                <Link key={restaurant.id} to={`/delivery/${restaurant.id}`}>
                  <Card className='hover:shadow-xl transition-all group overflow-hidden border-2 hover:border-red-200 h-full'>
                    {/* Imagen de portada */}
                    <div className='h-40 bg-gradient-to-br from-red-400 to-orange-500 relative'>
                      {restaurant.cover_image ? (
                        <img
                          src={restaurant.cover_image}
                          alt={restaurant.name}
                          className='w-full h-full object-cover group-hover:scale-110 transition-transform'
                        />
                      ) : (
                        <div className='flex items-center justify-center h-full'>
                          <UtensilsCrossed className='w-16 h-16 text-white opacity-50' />
                        </div>
                      )}

                      {/* Estado (abierto/cerrado) */}
                      <div className='absolute top-3 right-3'>
                        <Badge
                          className={
                            restaurant.is_open ? 'bg-green-500' : 'bg-red-500'
                          }
                        >
                          {restaurant.is_open ? 'Abierto' : 'Cerrado'}
                        </Badge>
                      </div>

                      {/* Logo del restaurante más bonito */}
                      {restaurant.logo_url && (
                        <div className='absolute bottom-0 left-4 translate-y-1/2 z-20'>
                          <div className='w-20 h-20 rounded-full bg-white/90 p-1 shadow-xl ring-2 ring-red-500/70 flex items-center justify-center backdrop-blur-sm'>
                            <img
                              src={restaurant.logo_url}
                              alt={restaurant.name}
                              className='w-full h-full object-cover rounded-full'
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <CardContent className='pt-10 pb-6 px-6'>
                      <h3 className='text-xl font-bold text-slate-900 mb-1 group-hover:text-red-600 transition-colors'>
                        {restaurant.name}
                      </h3>

                      {/* Dirección + número + ciudad */}
                      <p className='text-xs text-slate-500 mb-2 flex items-center gap-1.5'>
                        <MapPin className='w-3 h-3' />
                        {restaurant.address || 'Sin dirección'}
                        {restaurant.address_number
                          ? ` ${restaurant.address_number}`
                          : ''}
                        {restaurant.city ? `, ${restaurant.city}` : ''}
                      </p>
                      {restaurant.description && (
                        <p className='text-slate-600 text-sm mb-3 line-clamp-2'>
                          {restaurant.description}
                        </p>
                      )}

                      <div className='space-y-2'>
                        <div className='flex items-center justify-between text-sm'>
                          <div className='flex items-center text-slate-600'>
                            <Clock className='w-4 h-4 mr-2' />
                            {restaurant.delivery_time || '30-45 min'}
                          </div>

                          {/* === BLOQUE DE ESTRELLAS CLICKEABLES === */}
                          <div className='flex flex-col items-end'>
                            <div className='flex items-center gap-1'>
                              {Array.from({ length: 5 }).map((_, i) => {
                                const starValue = i + 1;
                                const filled =
                                  hasVotes && starValue <= roundedAvg;
                                const isUserStar = userRating === starValue;

                                return (
                                  <button
                                    key={starValue}
                                    type='button'
                                    onClick={(e) => {
                                      e.preventDefault(); // no navegar
                                      e.stopPropagation(); // no disparar Link
                                      handleRate(restaurant, starValue);
                                    }}
                                    className='focus:outline-none'
                                    title={
                                      user
                                        ? `Calificar con ${starValue} estrellas`
                                        : 'Iniciá sesión para calificar'
                                    }
                                  >
                                    <Star
                                      className={`w-6 h-6 transition-transform ${
                                        filled
                                          ? 'text-amber-400 fill-amber-400'
                                          : 'text-slate-300'
                                      } ${isUserStar ? 'scale-110' : ''}`}
                                    />
                                  </button>
                                );
                              })}
                              <span className='ml-2 text-xs text-slate-500'>
                                {hasVotes
                                  ? `${avgRating.toFixed(1)}/5 (${ratingCount})`
                                  : 'Sin valoraciones'}
                              </span>
                            </div>
                            {userRating && (
                              <p className='text-[11px] text-slate-500 mt-0.5'>
                                Tu voto: {userRating}★
                              </p>
                            )}
                          </div>
                        </div>

                        {restaurant.min_order && (
                          <div className='flex items-center text-slate-600 text-sm'>
                            <DollarSign className='w-4 h-4 mr-1' />
                            Pedido mínimo: $
                            {Number(restaurant.min_order).toLocaleString()}
                          </div>
                        )}

                        {restaurant.delivery_fee !== undefined && (
                          <div className='text-sm'>
                            {restaurant.delivery_fee === 0 ? (
                              <span className='text-green-600 font-medium'>
                                Envío gratis
                              </span>
                            ) : (
                              <span className='text-slate-600'>
                                Envío: ${restaurant.delivery_fee}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Botón Reportar */}
                      <div className='mt-4 flex justify-end'>
                        <button
                          type='button'
                          onClick={(e) => {
                            e.preventDefault(); // evita navegar al link
                            e.stopPropagation(); // evita que el Link se dispare
                            openReportModal(restaurant);
                          }}
                          className='text-xs inline-flex items-center gap-1 px-2 py-1 rounded-full border border-red-200 text-red-600 hover:bg-red-50 transition-colors'
                        >
                          <Flag className='w-3 h-3' />
                          Reportar
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}

            {filteredRestaurants.length === 0 && !isLoading && (
              <div className='col-span-full text-center py-12'>
                <UtensilsCrossed className='w-16 h-16 text-slate-300 mx-auto mb-4' />
                <p className='text-slate-600 text-lg'>
                  No se encontraron restaurantes
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      <Dialog
        open={!!reportRestaurant}
        onOpenChange={(open) => {
          if (!open) {
            setReportRestaurant(null);
            setReportComment('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reportar restaurante</DialogTitle>
          </DialogHeader>

          <p className='text-sm text-slate-600 mb-2'>
            Estás reportando:{' '}
            <span className='font-semibold'>
              {reportRestaurant?.name || 'Sin nombre'}
            </span>
          </p>

          <Textarea
            placeholder='Contanos qué está mal en este restaurante…'
            rows={4}
            value={reportComment}
            onChange={(e) => setReportComment(e.target.value)}
          />

          <div className='mt-4 flex justify-end gap-2'>
            <button
              type='button'
              className='text-sm px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100'
              onClick={() => {
                setReportRestaurant(null);
                setReportComment('');
              }}
              disabled={reportLoading}
            >
              Cancelar
            </button>

            <button
              type='button'
              onClick={submitReport}
              disabled={reportLoading || !reportComment.trim()}
              className='text-sm px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-60'
            >
              {reportLoading ? 'Enviando…' : 'Enviar reporte'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
