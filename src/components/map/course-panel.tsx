"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMapStore } from "@/lib/store/map-store";
import {
  Route,
  ChevronDown,
  ChevronUp,
  MapPin,
  Ruler,
  Compass,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────

interface RaceMark {
  id: string;
  name: string;
  short_name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  mark_type: string;
  color: string | null;
}

interface CourseLeg {
  leg_order: number;
  rounding: string;
  notes: string | null;
  mark: RaceMark;
}

interface RaceCourse {
  id: string;
  name: string;
  short_name: string | null;
  description: string | null;
  course_type: string;
  distance_nm: number | null;
}

// ─── Component ──────────────────────────────────────────────────────

export function CoursePanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [courses, setCourses] = useState<RaceCourse[]>([]);
  const [marks, setMarks] = useState<RaceMark[]>([]);
  const [loading, setLoading] = useState(false);

  const {
    selectedCourse,
    setSelectedCourse,
    courseLegs,
    setCourseLegs,
    showCourseOverlay,
    toggleCourseOverlay,
    showTacticalAnalysis,
    setShowTacticalAnalysis,
  } = useMapStore();

  // Fetch courses and marks on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const supabase = createClient();

      const [coursesRes, marksRes] = await Promise.all([
        supabase
          .from("race_courses")
          .select("*")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("race_marks")
          .select("*")
          .eq("is_active", true)
          .order("short_name"),
      ]);

      if (coursesRes.data) setCourses(coursesRes.data);
      if (marksRes.data) setMarks(marksRes.data);
      setLoading(false);
    };

    fetchData();
  }, []);

  // Fetch legs when a course is selected
  useEffect(() => {
    if (!selectedCourse) {
      setCourseLegs([]);
      return;
    }

    const fetchLegs = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("course_legs")
        .select(
          `
          leg_order,
          rounding,
          notes,
          mark_id
        `
        )
        .eq("course_id", selectedCourse.id)
        .order("leg_order");

      if (data) {
        // Join with marks
        const legsWithMarks: CourseLeg[] = data
          .map((leg: { leg_order: number; rounding: string; notes: string | null; mark_id: string }) => {
            const mark = marks.find((m) => m.id === leg.mark_id);
            if (!mark) return null;
            return {
              leg_order: leg.leg_order,
              rounding: leg.rounding,
              notes: leg.notes,
              mark,
            };
          })
          .filter(Boolean) as CourseLeg[];

        setCourseLegs(legsWithMarks);
      }
    };

    if (marks.length > 0) fetchLegs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourse, marks]);

  const handleCourseSelect = (course: RaceCourse) => {
    if (selectedCourse?.id === course.id) {
      setSelectedCourse(null);
    } else {
      setSelectedCourse(course);
    }
  };

  return (
    <div className="absolute bottom-2 right-2 z-10 w-72">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="mb-1 flex w-full items-center justify-between rounded-lg bg-card/95 px-3 py-2 shadow-lg backdrop-blur-sm hover:bg-card"
      >
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-ocean" />
          <span className="text-sm font-semibold text-foreground">
            Race Courses
          </span>
          {selectedCourse && (
            <span className="rounded bg-ocean/20 px-1.5 py-0.5 text-[10px] font-bold text-ocean">
              {selectedCourse.short_name || selectedCourse.name}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="max-h-[50vh] overflow-y-auto rounded-lg bg-card/95 shadow-lg backdrop-blur-sm">
          {/* Layer toggles */}
          <div className="border-b border-border px-3 py-2">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={showCourseOverlay}
                onChange={toggleCourseOverlay}
                className="rounded"
              />
              Show course marks on map
            </label>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* All marks count */}
              <div className="border-b border-border px-3 py-1.5">
                <p className="text-[10px] text-muted-foreground">
                  {marks.length} racing marks loaded
                </p>
              </div>

              {/* Course list */}
              <div className="p-2">
                <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Select Course
                </p>
                {courses.map((course) => {
                  const isSelected = selectedCourse?.id === course.id;
                  return (
                    <button
                      key={course.id}
                      onClick={() => handleCourseSelect(course)}
                      className={`mb-1 w-full rounded-md px-2 py-2 text-left transition-colors ${
                        isSelected
                          ? "bg-ocean/20 ring-1 ring-ocean/40"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">
                          {course.name}
                        </span>
                        {course.distance_nm && (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <Ruler className="h-3 w-3" />
                            {course.distance_nm} nm
                          </span>
                        )}
                      </div>
                      {course.description && (
                        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                          {course.description}
                        </p>
                      )}
                      <span className="mt-0.5 inline-block rounded bg-muted px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                        {course.course_type}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Selected course details */}
              {selectedCourse && courseLegs.length > 0 && (
                <div className="border-t border-border p-3">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Course Legs
                  </p>
                  <div className="space-y-1">
                    {courseLegs.map((leg, i) => (
                      <div
                        key={`${leg.mark.id}-${leg.leg_order}`}
                        className="flex items-center gap-2 text-xs"
                      >
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-ocean/20 text-[10px] font-bold text-ocean">
                          {leg.leg_order}
                        </div>
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{leg.mark.short_name}</span>
                        <span className="text-muted-foreground">
                          ({leg.rounding})
                        </span>
                        {i < courseLegs.length - 1 && (
                          <Compass className="ml-auto h-3 w-3 text-muted-foreground/50" />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* AI Tactical Analysis button */}
                  <button
                    onClick={() => setShowTacticalAnalysis(!showTacticalAnalysis)}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-ocean px-3 py-2 text-xs font-semibold text-white shadow-md transition-colors hover:bg-ocean/90"
                  >
                    {showTacticalAnalysis ? (
                      <>
                        <X className="h-3.5 w-3.5" />
                        Hide Analysis
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        AI Tactical Analysis
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
