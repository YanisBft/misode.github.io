import type { DocAndNode, Range } from '@spyglassmc/core'
import { dissectUri } from '@spyglassmc/java-edition/lib/binder/index.js'
import type { JsonNode } from '@spyglassmc/json'
import { JsonFileNode } from '@spyglassmc/json'
import { useCallback, useErrorBoundary, useMemo } from 'preact/hooks'
import { useLocale } from '../../contexts/index.js'
import { useDocAndNode, useSpyglass } from '../../contexts/Spyglass.jsx'
import { getRootType, simplifyType } from './McdocHelpers.js'
import type { McdocContext } from './McdocRenderer.jsx'
import { McdocRoot } from './McdocRenderer.jsx'

type TreePanelProps = {
	docAndNode: DocAndNode,
	onError: (message: string) => unknown,
}
export function Tree({ docAndNode: original, onError }: TreePanelProps) {
	const { lang } = useLocale()
	const { service } = useSpyglass()

	if (lang === 'none') return <></>

	const docAndNode = useDocAndNode(original)
	const fileChild = docAndNode.node.children[0]
	if (!JsonFileNode.is(fileChild)) {
		return <></>
	}

	const [error] = useErrorBoundary(e => {
		onError(`Error rendering the tree: ${e.message}`)
		console.error(e)
	})
	if (error) return <></>

	const makeEdit = useCallback((edit: (range: Range) => JsonNode | undefined) => {
		if (!service) {
			return
		}
		service.applyEdit(docAndNode.doc.uri, (fileNode) => {
			const jsonFile = fileNode.children[0]
			if (JsonFileNode.is(jsonFile)) {
				const original = jsonFile.children[0]
				const newNode = edit(original.range)
				if (newNode !== undefined) {
					newNode.parent = fileNode
					fileNode.children[0] = newNode
				}
			}
		})
	}, [service, docAndNode])

	const ctx = useMemo<McdocContext | undefined>(() => {
		if (!service) {
			return undefined
		}
		const errors = [
			...docAndNode.node.binderErrors ?? [],
			...docAndNode.node.checkerErrors ?? [],
			...docAndNode.node.linterErrors ?? [],
		]
		return service.getCheckerContext(docAndNode.doc, errors)
	}, [docAndNode, service])

	const resourceType = useMemo(() => {
		if (original.doc.uri.endsWith('/pack.mcmeta')) {
			return 'pack_mcmeta'
		}
		if (ctx === undefined) {
			return undefined
		}
		const res = dissectUri(original.doc.uri, ctx)
		return res?.category
	}, [original, ctx])

	const mcdocType = useMemo(() => {
		if (!ctx || !resourceType) {
			return undefined
		}
		const rootType = getRootType(resourceType)
		const type = simplifyType(rootType, ctx)
		return type
	}, [resourceType, ctx])

	return <div class="tree node-root" data-category={getCategory(resourceType)}>
		{(ctx && mcdocType) && <McdocRoot type={mcdocType} node={fileChild.children[0]} makeEdit={makeEdit} ctx={ctx} />}
	</div>
}

function getCategory(type: string | undefined) {
	switch (type) {
		case 'item_modifier': return 'function'
		case 'predicate': return 'predicate'
		default: return undefined
	}
}
