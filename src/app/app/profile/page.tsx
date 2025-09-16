"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BookOpen, CheckCircle2, Target, TrendingUp } from "lucide-react";

type ProgressData = {
  passed: number;
  reviewed: number;
  totalSenses: number;
};

type WordProgress = {
  word: string;
  totalSenses: number;
  reviewedSenses: number;
  passedSenses: number;
  completionRate: number;
};

export default function ProfilePage() {
  const [progress, setProgress] = React.useState<ProgressData | null>(null);
  const [wordProgress, setWordProgress] = React.useState<WordProgress[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function loadProgress() {
      try {
        setLoading(true);
        const res = await fetch("/api/me/progress", { credentials: "include" });
        if (!res.ok) throw new Error(`Failed to load progress (${res.status})`);
        const data = await res.json();
        setProgress(data);
        
        // Fetch word-level progress
        const wordsRes = await fetch("/api/me/words", { credentials: "include" });
        if (wordsRes.ok) {
          const wordsData = await wordsRes.json();
          setWordProgress(wordsData.words || []);
        }
        
        setError(null);
      } catch (e: any) {
        setError(e?.message || "Failed to load progress");
      } finally {
        setLoading(false);
      }
    }
    loadProgress();
  }, []);

  const reviewedPercentage = progress ? Math.round((progress.reviewed / progress.totalSenses) * 100) : 0;
  const passedPercentage = progress ? Math.round((progress.passed / progress.totalSenses) * 100) : 0;

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-foreground/70">Your vocabulary learning progress and statistics.</p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Progress Overview Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-600" />
                  <div className="text-xs text-foreground/60">Reviewed Senses</div>
                </div>
                <div className="text-2xl font-semibold">{progress?.reviewed || 0}</div>
                <div className="text-xs text-foreground/60">
                  {reviewedPercentage}% of {progress?.totalSenses || 0} total
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <div className="text-xs text-foreground/60">Passed Senses</div>
                </div>
                <div className="text-2xl font-semibold">{progress?.passed || 0}</div>
                <div className="text-xs text-foreground/60">
                  {passedPercentage}% of {progress?.totalSenses || 0} total
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-purple-600" />
                  <div className="text-xs text-foreground/60">Total Senses</div>
                </div>
                <div className="text-2xl font-semibold">{progress?.totalSenses || 0}</div>
                <div className="text-xs text-foreground/60">
                  SAT vocabulary database
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Progress Bars */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Review Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Reviewed</span>
                    <span>{reviewedPercentage}%</span>
                  </div>
                  <Progress value={reviewedPercentage} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Test Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Passed</span>
                    <span>{passedPercentage}%</span>
                  </div>
                  <Progress value={passedPercentage} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Word-Level Roll-ups */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Word Progress
              </CardTitle>
              <p className="text-sm text-foreground/70">
                Individual word completion rates and progress tracking.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {wordProgress.map((word) => (
                  <div key={word.word} className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                    <div className="flex items-center gap-3">
                      <div className="font-medium">{word.word}</div>
                      <Badge variant={word.completionRate === 100 ? "default" : word.completionRate > 0 ? "secondary" : "outline"}>
                        {word.completionRate}%
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-foreground/60">
                      <span>{word.reviewedSenses}/{word.totalSenses} reviewed</span>
                      <span>{word.passedSenses}/{word.totalSenses} passed</span>
                      <div className="w-20">
                        <Progress value={word.completionRate} className="h-1.5" />
                      </div>
                    </div>
                  </div>
                ))}
                {wordProgress.length === 0 && (
                  <div className="text-center py-8 text-foreground/60">
                    No word progress data available yet. Start reviewing or testing to see your progress!
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
