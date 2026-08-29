import json
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.core.cache import cache
from .models import User, PatientProfile, ClinicRegistry, PatientDoctorConsent, Roles, ClinicRating, FederationIDMap

class PatientMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cache_key = f"patient_me_{request.user.id}"
        data = cache.get(cache_key)
        
        if data is None:
            try:
                profile = request.user.patient_profile
                data = {
                    "first_name": profile.first_name,
                    "last_name": profile.last_name,
                    "name": f"{profile.first_name} {profile.last_name}".strip() or "Paciente",
                    "email": request.user.email_hash,
                    "phone": profile.phone or "",
                    "dob": str(profile.dob) if profile.dob else "",
                    "address": profile.address or "",
                    "gender": profile.gender or "",
                    "curp_or_mrn": profile.curp_or_mrn or "",
                    "blood_type": profile.blood_type or "",  
                    "allergies": profile.allergies or "", 
                    "aros_id": str(request.user.id)[:8],
                    "avatar_url": request.user.avatar.url if request.user.avatar else ""
                }
                cache.set(cache_key, data, timeout=300) # 5 minutes cache
            except PatientProfile.DoesNotExist:
                return JsonResponse({"error": "Profile not found"}, status=404)
                
        return JsonResponse(data)

    def put(self, request):
        try:
            profile, _ = PatientProfile.objects.get_or_create(user=request.user)
            
            data = request.data
            if 'first_name' in data:
                profile.first_name = data.get('first_name', '').strip()
            if 'last_name' in data:
                profile.last_name = data.get('last_name', '').strip()
            if 'phone' in data:
                profile.phone = data.get('phone', '').strip()
            if 'dob' in data and data.get('dob'):
                profile.dob = data.get('dob')
            if 'address' in data:
                profile.address = data.get('address', '').strip()
            if 'gender' in data:
                profile.gender = data.get('gender', 'O')
            if 'curp_or_mrn' in data:
                profile.curp_or_mrn = data.get('curp_or_mrn', '').strip()
            if 'blood_type' in data:
                profile.blood_type = data.get('blood_type', 'O+').strip()
            if 'allergies' in data:
                profile.allergies = data.get('allergies', 'Ninguna').strip()

            profile.save()

            # Handle password change if requested
            current_password = data.get('current_password')
            new_password = data.get('new_password')
            if current_password and new_password:
                if not request.user.check_password(current_password):
                    return JsonResponse({"error": "La contraseña actual es incorrecta."}, status=400)
                if len(new_password) < 6:
                    return JsonResponse({"error": "La nueva contraseña debe tener al menos 6 caracteres."}, status=400)
                request.user.set_password(new_password)
                request.user.save()

            # Invalidate cache
            cache.delete(f"patient_me_{request.user.id}")

            return JsonResponse({
                "status": "success",
                "first_name": profile.first_name,
                "last_name": profile.last_name,
                "name": f"{profile.first_name} {profile.last_name}".strip() or "Paciente",
                "email": request.user.email_hash,
                "phone": profile.phone,
                "dob": str(profile.dob) if profile.dob else None,
                "address": profile.address,
                "gender": profile.gender,
                "curp_or_mrn": profile.curp_or_mrn,
                "blood_type": profile.blood_type,
                "allergies": profile.allergies,
                "aros_id": str(request.user.id)[:8],
                "avatar_url": request.user.avatar.url if request.user.avatar else ""
            })
        except Exception as e:
            return JsonResponse({"error": f"Error al actualizar perfil: {str(e)}"}, status=500)

class PatientDoctorsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cache_key = f"patient_doctors_{request.user.id}"
        result = cache.get(cache_key)
        
        if result is None:
            doctor_roles = Roles.objects.filter(name__in=["Médico Asociado", "Radiólogo"])
            doctors = User.objects.filter(role__in=doctor_roles).select_related('staff_profile', 'role')
            consents = set(PatientDoctorConsent.objects.filter(patient=request.user, has_consent=True).values_list('doctor_id', flat=True))
            
            result = []
            for doc in doctors:
                sp = getattr(doc, 'staff_profile', None)
                if sp and (sp.first_name or sp.last_name):
                    doc_name = f"Dr/a. {sp.first_name} {sp.last_name}".strip()
                    avatar = (sp.first_name[:1] + (sp.last_name[:1] if sp.last_name else '')).upper()
                    specialty = sp.specialty or (doc.role.name if doc.role else "Medicina General")
                else:
                    raw_name = doc.email_hash.split('@')[0].replace('.', ' ').title()
                    doc_name = f"Dr/a. {raw_name}"
                    avatar = doc.email_hash[:2].upper()
                    specialty = doc.role.name if doc.role else "General"

                result.append({
                    "id": str(doc.id),
                    "name": doc_name,
                    "specialty": specialty,
                    "hospital": "Red Diagnóstica AROS",
                    "cedula": sp.cedula_profesional if sp else "",
                    "trusted": doc.id in consents,
                    "avatar": avatar
                })
            
            cache.set(cache_key, result, timeout=300)
            
        return JsonResponse(result, safe=False)
        
    def post(self, request):
        action = request.data.get('action')
        doctor_id = request.data.get('doctor_id')
        
        try:
            doctor = User.objects.get(id=doctor_id)
            consent, created = PatientDoctorConsent.objects.get_or_create(patient=request.user, doctor=doctor)
            
            if action == 'grant':
                consent.has_consent = True
            elif action == 'revoke':
                consent.has_consent = False
            
            consent.save()
            cache.delete(f"patient_doctors_{request.user.id}")
            
            return JsonResponse({"status": "success", "has_consent": consent.has_consent})
        except User.DoesNotExist:
            return JsonResponse({"error": "Doctor not found"}, status=404)

class ClinicsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        clinics = ClinicRegistry.objects.filter(is_active=True).prefetch_related('ratings')
        result = []
        for idx, c in enumerate(clinics):
            user_rating = c.ratings.filter(patient=request.user).first()
            # Verified attendance: patient attended if federated record exists or demo-clinic
            has_attended = FederationIDMap.objects.filter(user=request.user, clinic=c).exists() or (c.slug == 'demo-clinic')
            result.append({
                "id": c.slug,
                "name": c.name,
                "address": c.address or "Av. Insurgentes Sur 123, Roma Norte, CDMX",
                "phone": c.phone or "+52 55 5584 9200",
                "email": c.email or "contacto@aros-salud.mx",
                "rating": float(c.rating) if c.rating else 5.0,
                "total_reviews": c.total_reviews,
                "user_score": user_rating.score if user_rating else None,
                "has_attended": has_attended,
                "has_rated": user_rating is not None,
                "specialties": c.specialties or [
                    "Radiología Digital", "Tomografía (TAC)", "Resonancia Magnética", "Ultrasonido Doppler", "Mastografía"
                ],
                "opening_hours": c.opening_hours or "Lun - Vie: 07:00 - 20:00 | Sáb: 08:00 - 15:00",
                "primary_color": c.primary_color,
                "lat": c.latitude or (19.4184 - (idx * 0.01)),
                "lng": c.longitude or (-99.1643 + (idx * 0.01))
            })
            
        return JsonResponse(result, safe=False)

class ClinicRateView(APIView):
    """
    Allows authenticated patients to rate a clinic (1-5 stars) ONLY if they attended and ONLY once.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        clinic_id = request.data.get('clinic_id', 'demo-clinic')
        score = request.data.get('score')
        comment = request.data.get('comment', '')

        if not score:
            return JsonResponse({"error": "La puntuación es obligatoria."}, status=400)

        try:
            score_val = int(score)
            if score_val < 1 or score_val > 5:
                return JsonResponse({"error": "La puntuación debe ser entre 1 y 5 estrellas."}, status=400)
        except (ValueError, TypeError):
            return JsonResponse({"error": "Puntuación inválida."}, status=400)

        clinic = ClinicRegistry.objects.filter(slug=clinic_id).first() or ClinicRegistry.objects.first()
        if not clinic:
            return JsonResponse({"error": "Clínica no encontrada."}, status=404)

        # 1. Validation: Only clinics the patient has attended
        has_attended = FederationIDMap.objects.filter(user=request.user, clinic=clinic).exists() or (clinic.slug == 'demo-clinic')
        if not has_attended:
            return JsonResponse({
                "error": "Solo puedes calificar clínicas en las que hayas realizado estudios previamente."
            }, status=403)

        # 2. Validation: Patient can only rate once
        existing_rating = ClinicRating.objects.filter(clinic=clinic, patient=request.user).first()
        if existing_rating:
            return JsonResponse({
                "error": "Ya has calificado esta clínica previamente. Solo se permite una calificación por paciente."
            }, status=400)

        rating = ClinicRating.objects.create(
            clinic=clinic, 
            patient=request.user,
            score=score_val,
            comment=comment
        )

        clinic.update_rating_stats()
        cache.delete('clinics_view_list')

        return JsonResponse({
            "status": "success",
            "clinic_id": clinic.slug,
            "user_score": rating.score,
            "has_rated": True,
            "has_attended": True,
            "new_average": float(clinic.rating),
            "total_reviews": clinic.total_reviews
        })



