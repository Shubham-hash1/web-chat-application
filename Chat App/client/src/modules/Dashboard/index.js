import { useEffect, useRef, useState, useCallback } from 'react'
import Input from '../../components/Input'
import { io } from 'socket.io-client'
import { useNavigate } from 'react-router-dom'

// Premium Initials-Based Avatar Component
const Avatar = ({ name, email, size = 'w-[60px] h-[60px]', isOnline = false, showPulse = false }) => {
	const initials = name
		?.split(' ')
		.map(n => n[0])
		.slice(0, 2)
		.join('')
		.toUpperCase() || email?.[0]?.toUpperCase() || '?';

	// Generate a consistent color based on name string hash
	let hash = 0;
	const nameStr = name || email || '';
	for (let i = 0; i < nameStr.length; i++) {
		hash = nameStr.charCodeAt(i) + ((hash << 5) - hash);
	}
	const colors = [
		'bg-gradient-to-tr from-blue-500 to-indigo-600 text-white',
		'bg-gradient-to-tr from-purple-500 to-indigo-600 text-white',
		'bg-gradient-to-tr from-pink-500 to-rose-600 text-white',
		'bg-gradient-to-tr from-emerald-500 to-teal-600 text-white',
		'bg-gradient-to-tr from-violet-500 to-purple-600 text-white',
		'bg-gradient-to-tr from-cyan-500 to-blue-600 text-white',
		'bg-gradient-to-tr from-amber-500 to-orange-600 text-white',
	];
	const colorIndex = Math.abs(hash) % colors.length;
	const bgClass = colors[colorIndex];

	return (
		<div className="relative flex-shrink-0">
			<div className={`${size} rounded-full flex items-center justify-center font-semibold text-lg select-none shadow-md border-2 border-white ${bgClass}`}>
				{initials}
			</div>
			{isOnline && (
				<span className={`absolute bottom-0 right-0 block h-3.5 w-3.5 rounded-full ring-2 ring-white bg-green-500 ${showPulse ? 'pulse-online' : ''}`} />
			)}
		</div>
	);
};

const Dashboard = () => {
	const navigate = useNavigate()
	const [user] = useState(JSON.parse(localStorage.getItem('user:detail')))
	const [conversations, setConversations] = useState([])
	const [messages, setMessages] = useState({})
	const [message, setMessage] = useState('')
	const [users, setUsers] = useState([])
	const [activeUsers, setActiveUsers] = useState([])
	const [socket, setSocket] = useState(null)
	
	// Search states
	const [searchConversation, setSearchConversation] = useState('')
	const [searchPeople, setSearchPeople] = useState('')

	// Typing indicator states
	const [isTyping, setIsTyping] = useState(false)
	const [receiverTyping, setReceiverTyping] = useState(false)
	
	const messageRef = useRef(null)
	const activeReceiverIdRef = useRef(null)
	const typingTimeoutRef = useRef(null)

	// Keep active receiver ID up-to-date in Ref to avoid stale closure in socket listener
	useEffect(() => {
		activeReceiverIdRef.current = messages?.receiver?.receiverId;
		setReceiverTyping(false); // Reset typing status when switching chat
	}, [messages?.receiver?.receiverId]);

	const fetchConversations = useCallback(async () => {
		try {
			const res = await fetch(`http://localhost:8000/api/conversations/${user?.id}`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include'
			});
			if (res.status === 401 || res.status === 403) {
				localStorage.removeItem('user:detail');
				navigate('/users/sign_in');
				return;
			}
			const resData = await res.json()
			setConversations(resData)
		} catch (error) {
			console.error('Error fetching conversations:', error);
		}
	}, [user, navigate])

	const fetchUsers = useCallback(async () => {
		try {
			const res = await fetch(`http://localhost:8000/api/users/${user?.id}`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include'
			});
			if (res.status === 401 || res.status === 403) {
				localStorage.removeItem('user:detail');
				navigate('/users/sign_in');
				return;
			}
			const resData = await res.json()
			setUsers(resData)
		} catch (error) {
			console.error('Error fetching users:', error);
		}
	}, [user, navigate])

	useEffect(() => {
		setSocket(io('http://localhost:8080', {
			withCredentials: true
		}))
	}, [])

	useEffect(() => {
		if (!socket) return;

		socket.emit('addUser');

		socket.on('connect_error', (err) => {
			console.error('Socket connection error:', err.message);
			if (err.message.includes('Authentication error')) {
				localStorage.removeItem('user:detail');
				navigate('/users/sign_in');
			}
		});
		
		socket.on('getUsers', users => {
			console.log('activeUsers :>> ', users);
			setActiveUsers(users);
		});

		socket.on('getMessage', data => {
			if (data.senderId === user?.id) return;

			setMessages(prev => {
				if (prev?.conversationId === data.conversationId || (prev?.conversationId === 'new' && data.senderId === prev?.receiver?.receiverId)) {
					return {
						...prev,
						conversationId: data.conversationId,
						messages: [...(prev.messages || []), { 
							user: data.user, 
							message: data.message,
							createdAt: new Date().toISOString()
						}]
					};
				}
				return prev;
			});
			fetchConversations();
		});

		socket.on('typing', data => {
			if (data.senderId === activeReceiverIdRef.current) {
				setReceiverTyping(data.isTyping);
			}
		});

		return () => {
			socket.off('connect_error');
			socket.off('getUsers');
			socket.off('getMessage');
			socket.off('typing');
		};
	}, [socket, user, fetchConversations, navigate])

	useEffect(() => {
		messageRef?.current?.scrollIntoView({ behavior: 'smooth' })
	}, [messages?.messages, receiverTyping])

	useEffect(() => {
		if (user?.id) {
			fetchConversations()
			fetchUsers()
		}
	}, [user, fetchConversations, fetchUsers])

	const fetchMessages = async (conversationId, receiver) => {
		try {
			const res = await fetch(`http://localhost:8000/api/message/${conversationId}?senderId=${user?.id}&receiverId=${receiver?.receiverId}`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include'
			});
			if (res.status === 401 || res.status === 403) {
				localStorage.removeItem('user:detail');
				navigate('/users/sign_in');
				return;
			}
			const resData = await res.json()
			setMessages({ messages: resData.messages, receiver, conversationId: resData.conversationId })
		} catch (error) {
			console.error('Error fetching messages:', error);
		}
	}

	const handleInputChange = (e) => {
		setMessage(e.target.value);
		if (!socket || !messages?.receiver?.receiverId) return;

		if (!isTyping) {
			setIsTyping(true);
			socket.emit('typing', {
				senderId: user?.id,
				receiverId: messages?.receiver?.receiverId,
				isTyping: true
			});
		}

		if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

		typingTimeoutRef.current = setTimeout(() => {
			setIsTyping(false);
			socket.emit('typing', {
				senderId: user?.id,
				receiverId: messages?.receiver?.receiverId,
				isTyping: false
			});
		}, 1500);
	}

	const sendMessage = async (e) => {
		if (e) e.preventDefault();
		if (!message.trim()) return;

		const messageToSend = message;
		setMessage('')
		
		// Immediately clear typing state since message is sent
		if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
		setIsTyping(false);
		socket?.emit('typing', {
			senderId: user?.id,
			receiverId: messages?.receiver?.receiverId,
			isTyping: false
		});

		try {
			const res = await fetch(`http://localhost:8000/api/message`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify({
					conversationId: messages?.conversationId,
					senderId: user?.id,
					message: messageToSend,
					receiverId: messages?.receiver?.receiverId
				})
			});

			if (res.status === 401 || res.status === 403) {
				localStorage.removeItem('user:detail');
				navigate('/users/sign_in');
				return;
			}

			const resData = await res.json();

			socket?.emit('sendMessage', {
				senderId: user?.id,
				receiverId: messages?.receiver?.receiverId,
				message: messageToSend,
				conversationId: resData.conversationId
			});

			setMessages(prev => ({
				...prev,
				conversationId: resData.conversationId,
				messages: [...(prev.messages || []), { 
					user: { id: user?.id }, 
					message: messageToSend,
					createdAt: new Date().toISOString()
				}]
			}));

			fetchConversations();
		} catch (error) {
			console.error('Error sending message:', error);
		}
	}

	const formatTime = (dateString) => {
		if (!dateString) return '';
		const date = new Date(dateString);
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	// Filter search lists
	const filteredConversations = conversations.filter(({ user }) => 
		user?.fullName?.toLowerCase().includes(searchConversation.toLowerCase()) || 
		user?.email?.toLowerCase().includes(searchConversation.toLowerCase())
	);

	const filteredUsers = users.filter(({ user }) => 
		user?.fullName?.toLowerCase().includes(searchPeople.toLowerCase()) || 
		user?.email?.toLowerCase().includes(searchPeople.toLowerCase())
	);

	return (
		<div className='w-screen flex bg-slate-50 font-sans text-slate-800 antialiased'>
			{/* Left Column: Accounts & Chats */}
			<div className='w-[25%] h-screen bg-white border-r border-slate-200 flex flex-col'>
				<div className='flex items-center p-6 border-b border-slate-100 bg-slate-50/50'>
					<Avatar name={user?.fullName} email={user?.email} size="w-[50px] h-[50px]" />
					<div className='ml-4 mr-auto overflow-hidden'>
						<h3 className='text-lg font-bold truncate text-slate-900'>{user?.fullName}</h3>
						<p className='text-xs font-medium text-slate-400'>My Account</p>
					</div>
					<button 
						onClick={async () => {
							try {
								await fetch('http://localhost:8000/api/logout', {
									method: 'POST',
									credentials: 'include'
								});
							} catch (error) {
								console.error('Logout error:', error);
							}
							localStorage.removeItem('user:detail');
							navigate('/users/sign_in');
						}}
						className='p-2.5 text-slate-400 hover:text-rose-500 rounded-full hover:bg-rose-50 transition-all shadow-sm bg-white border border-slate-100'
						title='Logout'
					>
						<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
							<path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
						</svg>
					</button>
				</div>
				
				{/* Search Chats */}
				<div className='px-6 pt-5 pb-3 border-b border-slate-50'>
					<div className='relative'>
						<input 
							type='text' 
							placeholder='Search chats...' 
							value={searchConversation} 
							onChange={(e) => setSearchConversation(e.target.value)}
							className='w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary text-sm shadow-inner transition-all'
						/>
						<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
							<path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
						</svg>
					</div>
				</div>

				{/* Conversation List */}
				<div className='flex-1 overflow-y-auto custom-scrollbar px-6 py-4'>
					<div className='text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4'>Recent Messages</div>
					<div className='space-y-3'>
						{
							filteredConversations.length > 0 ?
								filteredConversations.map(({ conversationId, user }) => {
									const isOnline = activeUsers.some(u => u.userId === user?.receiverId);
									const isSelected = messages?.conversationId === conversationId;
									return (
										<div 
											key={conversationId} 
											onClick={() => fetchMessages(conversationId, user)}
											className={`flex items-center p-3 rounded-2xl cursor-pointer transition-all border ${isSelected ? 'bg-indigo-50/50 border-indigo-100 shadow-sm' : 'bg-white hover:bg-slate-50 border-slate-100 hover:border-slate-200'}`}
										>
											<Avatar name={user?.fullName} email={user?.email} size="w-[50px] h-[50px]" isOnline={isOnline} showPulse={isOnline} />
											<div className='ml-4 overflow-hidden flex-1'>
												<h3 className='text-sm font-bold truncate text-slate-900'>{user?.fullName}</h3>
												<p className='text-xs font-normal text-slate-400 truncate mt-0.5'>{user?.email}</p>
											</div>
										</div>
									)
								}) : <div className='text-center text-xs font-medium text-slate-400 mt-12 bg-slate-50 py-8 rounded-2xl border border-dashed border-slate-200'>No conversations found</div>
						}
					</div>
				</div>
			</div>

			{/* Middle Column: Chat Window */}
			<div className='w-[50%] h-screen bg-slate-50 flex flex-col'>
				{
					messages?.receiver?.fullName ? (
						<>
							{/* Active Receiver Profile Header */}
							<div className='bg-white border-b border-slate-200 h-[85px] flex items-center px-8 shadow-sm'>
								<Avatar 
									name={messages?.receiver?.fullName} 
									email={messages?.receiver?.email} 
									size="w-[50px] h-[50px]" 
									isOnline={activeUsers.some(u => u.userId === messages?.receiver?.receiverId)} 
									showPulse={activeUsers.some(u => u.userId === messages?.receiver?.receiverId)} 
								/>
								<div className='ml-4 overflow-hidden mr-auto'>
									<h3 className='text-base font-bold text-slate-950 truncate'>{messages?.receiver?.fullName}</h3>
									<p className={`text-xs transition-all font-medium ${receiverTyping ? 'text-green-500 font-semibold animate-pulse' : 'text-slate-400'}`}>
										{receiverTyping ? 'typing...' : (activeUsers.some(u => u.userId === messages?.receiver?.receiverId) ? 'Active Now' : 'Offline')}
									</p>
								</div>
								<div className='flex items-center space-x-3'>
									<button className='p-2.5 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-full transition-all border border-slate-100 shadow-sm bg-white' title='Call'>
										<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
											<path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
										</svg>
									</button>
								</div>
							</div>

							{/* Chat Messages */}
							<div className='flex-1 overflow-y-auto custom-scrollbar p-8 bg-slate-50'>
								<div className='space-y-4'>
									{
										messages?.messages?.length > 0 ? (
											messages.messages.map(({ message, user: { id } = {}, createdAt }, index) => {
												const isSelf = id === user?.id;
												return (
													<div 
														key={index} 
														className={`max-w-[65%] rounded-2xl p-4 shadow-sm flex flex-col relative border ${
															isSelf 
																? 'bg-gradient-to-br from-primary to-indigo-600 text-white rounded-tr-none ml-auto border-transparent shadow-indigo-100' 
																: 'bg-white text-slate-800 rounded-tl-none mr-auto border-slate-200/60 shadow-slate-100'
														}`}
													>
														<span className='text-sm font-normal break-words leading-relaxed'>{message}</span>
														<span className={`text-[10px] mt-1.5 self-end select-none font-medium ${isSelf ? 'text-blue-100' : 'text-slate-400'}`}>
															{formatTime(createdAt)}
														</span>
													</div>
												)
											})
										) : (
											<div className='text-center text-xs font-medium text-slate-400 mt-24 bg-white py-10 px-6 rounded-3xl shadow-sm border border-slate-100 max-w-sm mx-auto'>
												Say hello to initiate your conversation!
											</div>
										)
									}
									{receiverTyping && (
										<div className='flex items-center space-x-1.5 bg-slate-200/50 w-[70px] justify-center p-3.5 rounded-2xl rounded-tl-none border border-slate-200/30 shadow-inner mr-auto'>
											<span className='h-2 w-2 bg-slate-400 rounded-full animate-bounce' style={{ animationDelay: '0ms' }} />
											<span className='h-2 w-2 bg-slate-400 rounded-full animate-bounce' style={{ animationDelay: '150ms' }} />
											<span className='h-2 w-2 bg-slate-400 rounded-full animate-bounce' style={{ animationDelay: '300ms' }} />
										</div>
									)}
									<div ref={messageRef}></div>
								</div>
							</div>

							{/* Chat Input Bar */}
							<form onSubmit={sendMessage} className='p-6 bg-white border-t border-slate-200 flex items-center space-x-4'>
								<Input 
									placeholder='Type a message...' 
									value={message} 
									onChange={handleInputChange} 
									className='flex-1' 
									inputClassName='py-3.5 px-6 border border-slate-200 focus:border-indigo-300 shadow-sm rounded-full bg-slate-50 focus:bg-white focus:ring-4 focus:ring-primary/10 outline-none text-sm transition-all' 
								/>
								<button 
									type="submit" 
									disabled={!message.trim()}
									className={`p-3.5 bg-primary text-white rounded-full shadow-md hover:shadow-lg transition-all ${
										!message.trim() ? 'opacity-40 cursor-not-allowed bg-slate-300 shadow-none' : 'hover:bg-indigo-600 bg-gradient-to-tr from-primary to-indigo-600'
									}`}
								>
									<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
										<path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
									</svg>
								</button>
							</form>
						</>
					) : (
						<div className='flex-1 flex flex-col items-center justify-center p-12 text-center'>
							<div className='p-6 bg-indigo-50 rounded-full text-indigo-500 mb-6 shadow-inner border border-indigo-100/50'>
								<svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
									<path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
								</svg>
							</div>
							<h3 className='text-xl font-bold text-slate-800 mb-2'>No active conversation</h3>
							<p className='text-sm text-slate-400 max-w-sm leading-relaxed'>Select an existing chat from the left sidebar or select a contact from the right sidebar to start messaging.</p>
						</div>
					)
				}
			</div>

			{/* Right Column: People List */}
			<div className='w-[25%] h-screen bg-white border-l border-slate-200 flex flex-col'>
				<div className='p-6 border-b border-slate-100 bg-slate-50/50 flex items-center h-[85px]'>
					<div className='text-lg font-bold text-slate-900'>Contacts</div>
				</div>
				
				{/* Search People */}
				<div className='px-6 pt-5 pb-3 border-b border-slate-50'>
					<div className='relative'>
						<input 
							type='text' 
							placeholder='Search people...' 
							value={searchPeople} 
							onChange={(e) => setSearchPeople(e.target.value)}
							className='w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary text-sm shadow-inner transition-all'
						/>
						<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
							<path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
						</svg>
					</div>
				</div>

				{/* People List */}
				<div className='flex-1 overflow-y-auto custom-scrollbar px-6 py-4'>
					<div className='text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4'>Available Contacts</div>
					<div className='space-y-3'>
						{
							filteredUsers.length > 0 ?
								filteredUsers.map(({ user }) => {
									const isOnline = activeUsers.some(u => u.userId === user?.receiverId);
									return (
										<div 
											key={user?.receiverId} 
											onClick={() => fetchMessages('new', user)}
											className='flex items-center p-3 rounded-2xl cursor-pointer hover:bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all bg-white'
										>
											<Avatar name={user?.fullName} email={user?.email} size="w-[50px] h-[50px]" isOnline={isOnline} />
											<div className='ml-4 overflow-hidden flex-1'>
												<h3 className='text-sm font-bold truncate text-slate-900'>{user?.fullName}</h3>
												<p className='text-xs font-normal text-slate-400 truncate mt-0.5'>{user?.email}</p>
											</div>
										</div>
									)
								}) : <div className='text-center text-xs font-medium text-slate-400 mt-12 bg-slate-50 py-8 rounded-2xl border border-dashed border-slate-200'>No contacts found</div>
						}
					</div>
				</div>
			</div>
		</div>
	)
}

export default Dashboard