import Editor from "@monaco-editor/react";
import { Type } from "@sinclair/typebox";
import { Compile } from "@sinclair/typemap";
import { useThrottledCallback } from "@tanstack/react-pacer/throttler";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import { isNil } from "es-toolkit";
import { get, has } from "es-toolkit/compat";
import { LucideCloudUpload } from "lucide-react";
import { Fragment, useEffect } from "react";
import { Streamdown } from "streamdown";
import { localjudge } from "@/api/client";
import { $localjudge } from "@/api/fetch";
import { BufferTextBlock } from "@/components/buffer-text-block";
import { useTheme } from "@/components/providers/theme";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
	Select,
	SelectItem,
	SelectPopup,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import {
	createSubmission,
	SolutionSnapshotter,
	setStoreContent,
	solutionStore,
} from "@/lib/client/solution-manager";
import { rejectError } from "@/lib/utils";

export const Route = createFileRoute(
	"/_authenticated/contest/$id/problem/$problem",
)({
	loader: async ({ params }) => {
		const [problem, testcases] = await Promise.all([
			rejectError(
				localjudge
					.contest({ id: params.id })
					.problem({ problem: params.problem })
					.get(),
			),
			rejectError(
				localjudge
					.contest({ id: params.id })
					.problem({ problem: params.problem })
					.testcase.get(),
			),
		]);
		return { problem, testcases };
	},
	validateSearch: Compile(
		Type.Object({ language: Type.Optional(Type.String()) }),
	),
	component: RouteComponent,
});

function SubmitCode() {
	const { id, problem } = Route.useParams();
	const language = Route.useSearch({ select: (s) => s.language! });

	return (
		<Button
			variant="secondary"
			onClick={() => createSubmission(id, Number.parseInt(problem), language)}
		>
			<LucideCloudUpload />
			Submit
		</Button>
	);
}

function LanguageSelect() {
	const languages = Route.useRouteContext({
		select: (data) => data.contest.settings.languages,
	});
	const value = Route.useSearch({ select: (s) => s.language! });
	const navigate = Route.useNavigate();

	return (
		<Select
			value={value}
			onValueChange={(language) => {
				if (language) {
					navigate({
						search: { language },
					});
				}
			}}
		>
			<SelectTrigger className="min-w-auto w-min">
				<SelectValue />
			</SelectTrigger>
			<SelectPopup>
				{languages.map((lang) => (
					<SelectItem key={lang} value={lang}>
						{lang}
					</SelectItem>
				))}
			</SelectPopup>
		</Select>
	);
}

function TestcaseContent({ number }: { number: number }) {
	const { id, problem } = Route.useParams();
	const { data, error, isLoading } = useQuery({
		queryKey: [
			"/api/contest/:id/problem/:problem/testcase/:testcase",
			{ id, problem: Number.parseInt(problem), testcase: number },
		] as const,
		queryFn: async ({ queryKey: [url, params] }) =>
			rejectError($localjudge(url, { method: "GET", params })),
		staleTime: Number.POSITIVE_INFINITY,
	});

	if (isLoading) return <Skeleton className="h-64" />;
	if (error || data === undefined)
		return (
			<Alert>
				<AlertTitle>Error loading testcase contest</AlertTitle>
				<AlertDescription>{JSON.stringify(error)}</AlertDescription>
			</Alert>
		);

	return (
		<Fragment>
			<BufferTextBlock label="Input">{data.input}</BufferTextBlock>
			<Separator className="my-4" />
			<BufferTextBlock label="Expected Output">{data.output}</BufferTextBlock>
		</Fragment>
	);
}

function TestcaseList() {
	const testcases = Route.useLoaderData({ select: (data) => data.testcases });

	return (
		<Tabs
			orientation="vertical"
			className="w-full flex-row items-start mt-2"
			defaultValue={testcases[0]?.number}
		>
			<TabsList className="flex-col h-auto" aria-label="Testcases">
				{testcases.map((tc) => (
					<TabsTrigger
						disabled={tc.hidden}
						value={tc.number}
						key={tc.number}
						className="w-full"
					>
						Case {tc.number}
					</TabsTrigger>
				))}
			</TabsList>
			<div className="grow pl-4">
				{testcases.map((tc) => (
					<TabsPanel key={tc.number} value={tc.number}>
						<TestcaseContent number={tc.number} />
					</TabsPanel>
				))}
			</div>
		</Tabs>
	);
}

function ProblemStatement() {
	const problem = Route.useLoaderData({
		select: (data) => data.problem,
	});

	return (
		<Fragment>
			<h3 className="scroll-m-20 text-xl md:text-3xl font-semibold tracking-tight">
				{problem.title}
			</h3>
			<Streamdown>{problem.description}</Streamdown>
		</Fragment>
	);
}

function CodeEditor() {
	const [theme] = useTheme();
	const { id, problem } = Route.useParams();
	const language = Route.useSearch({ select: (s) => s.language! });
	const value = useStore(solutionStore, (state) =>
		get(state, [language, problem], "Loading..."),
	);

	useEffect(() => {
		if (!has(solutionStore.state, [language, problem])) {
			// restore from previous snapshot
			localjudge
				.contest({ id })
				.problem({ problem })
				.snapshot({ language })
				.get()
				.then(({ data, error }) => {
					if (error) {
						console.error(error);
					}
					setStoreContent(
						language,
						Number.parseInt(problem),
						data ?? "Error loading snapshot",
					);
				});
		}
	}, [language, problem]);

	const throttledUpdate = useThrottledCallback(
		(content: string) =>
			setStoreContent(language, Number.parseInt(problem), content),
		{
			wait: 1000,
		},
	);

	return (
		<Editor
			theme={theme === "dark" ? "vs-dark" : "light"}
			language={language}
			path={`${problem}/${language}`}
			value={value}
			onChange={(value) => throttledUpdate(value ?? "")}
			options={{
				folding: false,
				lineNumbers: "on",
				fontFamily: "var(--font-mono), monospace",
				padding: {
					top: 8,
				},
				minimap: {
					enabled: false,
				},
			}}
		/>
	);
}

function RouteComponent() {
	const languages = Route.useRouteContext({
		select: (data) => data.contest.settings.languages,
	});
	const language = Route.useSearch({ select: (s) => s.language });

	if (isNil(language)) {
		return (
			<Navigate
				from={Route.fullPath}
				search={{ language: languages[0] }}
				replace
			/>
		);
	}

	return (
		<Fragment>
			<div className="flex shrink-0 h-14 items-center justify-between gap-2 border-b px-4">
				<div className="inline-flex items-center gap-2">
					<SidebarTrigger className="-ml-1" />
					Problems
				</div>
				<SubmitCode />
				<div className="inline-flex items-center gap-2">
					<SolutionSnapshotter />
					<LanguageSelect />
				</div>
			</div>
			<ResizablePanelGroup direction="horizontal" className="h-full">
				<ResizablePanel className="py-2 px-4">
					<Tabs defaultValue="statement">
						<TabsList className="w-full">
							<TabsTrigger value="statement">Statement</TabsTrigger>
							<TabsTrigger value="testcases">Testcases</TabsTrigger>
						</TabsList>
						<TabsPanel value="statement">
							<ProblemStatement />
						</TabsPanel>
						<TabsPanel value="testcases">
							<TestcaseList />
						</TabsPanel>
					</Tabs>
				</ResizablePanel>
				<ResizableHandle />
				<ResizablePanel>
					<CodeEditor />
				</ResizablePanel>
			</ResizablePanelGroup>
		</Fragment>
	);
}
