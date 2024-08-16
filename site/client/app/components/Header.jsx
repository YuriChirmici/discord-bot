import Link from "next/link";

const Header = () => {
	return (
		<header>
			<span>
				Config
			</span>
			<nav>
				<Link href="/"> Home </Link>
			</nav>
		</header>
	);
};

export default Header;
